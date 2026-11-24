import type { CaptionJobUpdate } from '@/utils/caption-job-client'
import {
  CAPTIONS_PER_JOB,
  MAX_ACTIVE_JOBS_PER_USER,
  MAX_JOBS_PER_USER_PER_HOUR,
  STALE_JOB_MS,
  type PipelineConfig,
} from './config'
import {
  CaptionModelError,
  downloadImage,
  writeCaptionsWithFallback,
  writeCaptionsWithGemini,
} from './gemini'
import { chooseStyles, toHumorStyle, type GeminiCaptionReply, type HumorStyle } from './prompt'
import type { AdminClient } from './server'

type JobRow = {
  id: string
  profile_id: string
  image_id: string
  status: CaptionJobUpdate['status']
  total: number
  completed: number
  failed: number
  completed_steps: number
  total_steps: number
  caption_ids: string[]
  error: string | null
  updated_at: string
}

const JOB_COLUMNS =
  'id,profile_id,image_id,status,total,completed,failed,completed_steps,total_steps,' +
  'caption_ids,error,updated_at'

/** Used only if the humor_flavors table is empty. */
const FALLBACK_STYLES: HumorStyle[] = [
  { id: -1, name: 'relatable student life', description: 'Everyday college struggles.' },
  { id: -2, name: 'dramatic overreaction', description: 'Treat something small as epic.' },
  { id: -3, name: 'deadpan', description: 'Dry, understated, matter-of-fact.' },
  { id: -4, name: 'pov', description: 'A "POV:" caption from someone in the photo.' },
]

export function toJobUpdate(row: JobRow): CaptionJobUpdate {
  return {
    jobId: row.id,
    status: row.status,
    captionIds: row.caption_ids ?? [],
    error: row.error,
    progress: {
      total: row.total,
      completed: row.completed,
      failed: row.failed,
      completedSteps: row.completed_steps,
      totalSteps: row.total_steps,
    },
  }
}

/** Friendly reason codes a job can fail with. */
export type JobStartError = { kind: 'image_not_found' } | { kind: 'rate_limited'; message: string }

/**
 * Create a job for this user and image, or return the existing one for the
 * same idempotency key (so a retried request never writes captions twice).
 */
export async function createOrReuseJob(
  admin: AdminClient,
  input: { userId: string; imageId: string; idempotencyKey: string }
): Promise<{ job: JobRow; isNew: boolean } | JobStartError> {
  const { userId, imageId, idempotencyKey } = input

  const existing = await admin
    .from('crackd_caption_jobs')
    .select(JOB_COLUMNS)
    .eq('profile_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle<JobRow>()
  if (existing.error) throw existing.error
  if (existing.data) return { job: existing.data, isNew: false }

  // The user may caption public images and their own images.
  const image = await admin
    .from('images')
    .select('id,profile_id,is_public,url')
    .eq('id', imageId)
    .maybeSingle()
  if (image.error) throw image.error
  if (!image.data?.url || (!image.data.is_public && image.data.profile_id !== userId)) {
    return { kind: 'image_not_found' }
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent = await admin
    .from('crackd_caption_jobs')
    .select('status,updated_at')
    .eq('profile_id', userId)
    .gte('created_at', hourAgo)
  if (recent.error) throw recent.error
  const active = (recent.data ?? []).filter(
    (job) =>
      ['queued', 'running'].includes(job.status) &&
      Date.now() - new Date(job.updated_at).getTime() < STALE_JOB_MS
  )
  if (active.length >= MAX_ACTIVE_JOBS_PER_USER) {
    return { kind: 'rate_limited', message: 'Please wait for your current captions to finish.' }
  }
  if ((recent.data ?? []).length >= MAX_JOBS_PER_USER_PER_HOUR) {
    return { kind: 'rate_limited', message: "You've made a lot of captions. Try again later." }
  }

  const inserted = await admin
    .from('crackd_caption_jobs')
    .insert({ profile_id: userId, image_id: imageId, idempotency_key: idempotencyKey })
    .select(JOB_COLUMNS)
    .single<JobRow>()
  if (inserted.error) {
    // Two identical requests raced: return the one that won.
    if (inserted.error.code === '23505') {
      return createOrReuseJob(admin, input)
    }
    throw inserted.error
  }
  return { job: inserted.data, isNew: true }
}

/** Read a job for its owner. Jobs stuck with no progress are marked failed. */
export async function getJobForUser(
  admin: AdminClient,
  jobId: string,
  userId: string
): Promise<CaptionJobUpdate | null> {
  const { data, error } = await admin
    .from('crackd_caption_jobs')
    .select(JOB_COLUMNS)
    .eq('id', jobId)
    .eq('profile_id', userId)
    .maybeSingle<JobRow>()
  if (error) throw error
  if (!data) return null

  const stale =
    ['queued', 'running'].includes(data.status) &&
    Date.now() - new Date(data.updated_at).getTime() > STALE_JOB_MS
  if (stale) {
    const failed = { ...data, status: 'failed' as const, error: 'Timed out' }
    await admin
      .from('crackd_caption_jobs')
      .update({ status: 'failed', error: 'Timed out', updated_at: new Date().toISOString() })
      .eq('id', jobId)
    return toJobUpdate(failed)
  }
  return toJobUpdate(data)
}

type RunDeps = {
  admin: AdminClient
  config: PipelineConfig
  /** Swappable in tests. */
  writeCaptions?: typeof writeCaptionsWithGemini
  download?: typeof downloadImage
  sleep?: (ms: number) => Promise<void>
}

/**
 * The background work for one job:
 *   step 1 read the photo, step 2 write captions with Gemini, step 3 save them.
 * Progress is saved after each step so the app's progress screen can show it.
 */
export async function runCaptionJob(jobId: string, deps: RunDeps): Promise<void> {
  const { admin, config } = deps
  const write = deps.writeCaptions ?? writeCaptionsWithGemini
  const download = deps.download ?? downloadImage
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))

  const update = async (fields: Partial<JobRow>) => {
    const { error } = await admin
      .from('crackd_caption_jobs')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', jobId)
    if (error) throw error
  }

  try {
    const { data: job, error: jobError } = await admin
      .from('crackd_caption_jobs')
      .select(JOB_COLUMNS)
      .eq('id', jobId)
      .single<JobRow>()
    if (jobError) throw jobError
    if (job.status !== 'queued') return // already started elsewhere

    await update({ status: 'running', completed_steps: 0 })

    // Step 1: read the photo.
    const { data: image, error: imageError } = await admin
      .from('images')
      .select('id,url,image_description')
      .eq('id', job.image_id)
      .single()
    if (imageError || !image?.url) throw new CaptionModelError('The photo could not be found.')
    const photo = await download(image.url)

    const [{ data: flavorRows }, { data: exampleRows }] = await Promise.all([
      admin.from('humor_flavors').select('id,slug,description,is_pinned'),
      admin
        .from('captions')
        .select('content')
        .eq('is_public', true)
        .gt('like_count', 0)
        .order('like_count', { ascending: false })
        .limit(8),
    ])
    const styles = flavorRows?.length
      ? chooseStyles(flavorRows, CAPTIONS_PER_JOB).map(toHumorStyle)
      : FALLBACK_STYLES
    const examples = (exampleRows ?? []).map((row) => row.content?.trim() ?? '').filter(Boolean)
    await update({ completed_steps: 1, total: styles.length })
    
    // Step 2: write captions. If a Gemini model is busy or slow, the next one is tried.
    const reply: GeminiCaptionReply = await writeCaptionsWithFallback(
      {
        apiKey: config.geminiApiKey,
        models: config.geminiModels,
        image: photo,
        styles,
        examples,
        // Keep the job marked as alive while trying models.
        onAttempt: () => update({}),
      },
      { write, sleep }
    )
    await update({ completed_steps: 2 })

    // Step 3: save them as private captions owned by the user (they choose what to Post).
    let captionIds: string[] = []
    if (reply.captions.length > 0) {
      const { data: captionRequest, error: requestError } = await admin
        .from('caption_requests')
        .insert({
          image_id: job.image_id,
          profile_id: job.profile_id,
          created_by_user_id: job.profile_id,
          modified_by_user_id: job.profile_id,
        })
        .select('id')
        .single()
      if (requestError) throw requestError

      const rows = reply.captions.map((caption) => ({
        content: caption.text,
        image_id: job.image_id,
        profile_id: job.profile_id,
        humor_flavor_id: caption.flavorId > 0 ? caption.flavorId : null,
        caption_request_id: captionRequest.id,
        is_public: false,
        created_by_user_id: job.profile_id,
        modified_by_user_id: job.profile_id,
      }))
      const { data: saved, error: saveError } = await admin
        .from('captions')
        .insert(rows)
        .select('id,content')
      if (saveError) throw saveError
      // Keep the order the styles were requested in.
      const idByContent = new Map((saved ?? []).map((row) => [row.content, row.id]))
      captionIds = rows
        .map((row) => idByContent.get(row.content))
        .filter((id): id is string => Boolean(id))
    }

    if (!image.image_description && reply.imageDescription) {
      await admin
        .from('images')
        .update({ image_description: reply.imageDescription })
        .eq('id', job.image_id)
    }

    const completed = captionIds.length
    await update({
      status:
        completed === 0
          ? 'failed'
          : completed < styles.length
            ? 'partially_completed'
            : 'completed',
      completed,
      failed: styles.length - completed,
      completed_steps: 3,
      caption_ids: captionIds,
      error: completed === 0 ? 'No captions were written.' : null,
    })
  } catch (error) {
    console.error(`Caption job ${jobId} failed:`, error)
    const message =
      error instanceof CaptionModelError
        ? error.message
        : 'Something went wrong while writing captions.'
    await update({ status: 'failed', error: message }).catch((updateError) =>
      console.error(`Could not mark caption job ${jobId} as failed:`, updateError)
    )
  }
}
