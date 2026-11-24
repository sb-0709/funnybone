import { NextResponse, after } from 'next/server'

import { createOrReuseJob, runCaptionJob, toJobUpdate } from '@/lib/caption-pipeline/jobs'
import { UUID_PATTERN, getPipelineContext, jsonError } from '@/lib/caption-pipeline/server'

// Writing captions runs after the response is sent; give it time to finish.
export const maxDuration = 240

/**
 * POST { imageId } with an Idempotency-Key header → { jobId, status, ... }
 * Starts a caption job and returns right away. The app then checks
 * /api/pipeline/caption-job/<jobId> every few seconds.
 */
export async function POST(request: Request) {
  const context = await getPipelineContext(request)
  if (context instanceof NextResponse) return context
  const { admin, config, userId } = context

  const idempotencyKey = request.headers.get('idempotency-key') ?? ''
  if (!UUID_PATTERN.test(idempotencyKey)) {
    return jsonError(400, 'invalid_request', 'Missing request key.')
  }
  const body = (await request.json().catch(() => null)) as { imageId?: unknown } | null
  const imageId = typeof body?.imageId === 'string' ? body.imageId : ''
  if (!UUID_PATTERN.test(imageId)) {
    return jsonError(400, 'invalid_request', 'Missing image.')
  }

  const result = await createOrReuseJob(admin, { userId, imageId, idempotencyKey })
  if ('kind' in result) {
    return result.kind === 'image_not_found'
      ? jsonError(404, 'image_not_found', 'That photo could not be found.')
      : jsonError(429, 'rate_limited', result.message)
  }

  if (result.isNew) {
    after(() => runCaptionJob(result.job.id, { admin, config }))
  }

  return NextResponse.json(toJobUpdate(result.job), { status: result.isNew ? 202 : 200 })
}
