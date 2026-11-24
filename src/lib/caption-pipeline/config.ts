/**
 * Server-only settings for the built-in caption service.
 * Set these in .env.local (and in Vercel → Settings → Environment Variables):
 *   SUPABASE_SERVICE_ROLE_KEY  Supabase → Project Settings → API keys → service_role (secret)
 *   GEMINI_API_KEY             https://aistudio.google.com/apikey
 *   GEMINI_MODEL               optional, defaults to "gemini-flash-latest"
 * None of these start with NEXT_PUBLIC_, so they are never sent to the browser.
 */
export const UPLOAD_BUCKET = 'caption-uploads'

/** Photo types Gemini can read (and the upload bucket accepts). */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** How many humor styles (and so captions) each job writes. */
export const CAPTIONS_PER_JOB = 6

/** Safety limits so one account can't use up the free Gemini quota. */
export const MAX_ACTIVE_JOBS_PER_USER = 2
export const MAX_JOBS_PER_USER_PER_HOUR = 20

/** A job with no progress for this long is treated as failed. */
export const STALE_JOB_MS = 3 * 60 * 1000

/**
 * Gemini models tried in order. If one is overloaded, slow or unavailable,
 * the next is used. Flash-Lite is fast and usually the least busy; Flash is
 * Google's main model; "flash-latest" always points at the newest Flash.
 * (Gemini 2.5 models are no longer offered to new API keys.)
 */
export const DEFAULT_GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
]

export type PipelineConfig = {
  supabaseUrl: string
  serviceRoleKey: string
  geminiApiKey: string
  /** Models to try, in order. */
  geminiModels: string[]
}

/** Returns null when the service isn't configured, so routes can answer 503. */
export function getPipelineConfig(): PipelineConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const geminiApiKey = process.env.GEMINI_API_KEY
  if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) return null
  return {
    supabaseUrl,
    serviceRoleKey,
    geminiApiKey,
    geminiModels: [
      ...new Set(
        [process.env.GEMINI_MODEL?.trim(), ...DEFAULT_GEMINI_MODELS].filter(
          (model): model is string => Boolean(model)
        )
      ),
    ],
  }
}
