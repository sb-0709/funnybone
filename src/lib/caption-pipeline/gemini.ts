import { MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES } from './config'
import {
  SYSTEM_PROMPT,
  buildResponseSchema,
  buildUserPrompt,
  parseCaptionReply,
  type GeminiCaptionReply,
  type HumorStyle,
} from './prompt'

export class CaptionModelError extends Error {
  /** True when another model, or a retry later, might work (busy, slow, unavailable). */
  readonly temporary: boolean
  /** True when this model doesn't exist for this API key, so retrying it is pointless. */
  readonly modelMissing: boolean
  constructor(message: string, temporary = false, modelMissing = false) {
    super(message)
    this.temporary = temporary
    this.modelMissing = modelMissing
  }
}

/** How long to wait for one Gemini answer before trying the next model. */
const GEMINI_TIMEOUT_MS = 30_000

export type DownloadedImage = { mimeType: string; base64: string }

// Never fetch from private or local network addresses.
const BLOCKED_HOSTS = new RegExp(
  '^(localhost|127\\.|10\\.|192\\.168\\.|169\\.254\\.' +
    '|172\\.(1[6-9]|2\\d|3[01])\\.|0\\.|\\[?::1\\]?$)',
  'i'
)

/** Download a public image (with size, type and address checks) for the model. */
export async function downloadImage(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<DownloadedImage> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new CaptionModelError('This image link is not valid.')
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || BLOCKED_HOSTS.test(parsed.hostname)) {
    throw new CaptionModelError('This image link is not allowed.')
  }

  const response = await fetchImpl(parsed, {
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new CaptionModelError(`The photo could not be downloaded (${response.status}).`)
  }
  const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const normalized = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
  if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(normalized)) {
    await response.body?.cancel()
    throw new CaptionModelError('Only JPG, PNG, WEBP and HEIC photos can be captioned.')
  }
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_IMAGE_BYTES) {
    await response.body?.cancel()
    throw new CaptionModelError('This photo is larger than 10 MB.')
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new CaptionModelError('This photo is larger than 10 MB.')
  }
  return { mimeType: normalized, base64: bytes.toString('base64') }
}

/** One Gemini call: the photo plus every humor style → one caption per style. */
export async function writeCaptionsWithGemini(
  options: {
    apiKey: string
    model: string
    image: DownloadedImage
    styles: HumorStyle[]
    examples: string[]
  },
  fetchImpl: typeof fetch = fetch
): Promise<GeminiCaptionReply> {
  const { apiKey, model, image, styles, examples } = options
  const endpoint =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    `${encodeURIComponent(model)}:generateContent`

  // Gemini 2.5 models "think" before answering by default; captions don't need it,
  // and turning it off makes answers several times faster.
  const thinkingConfig = /2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}

  let response: Response
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: image.mimeType, data: image.base64 } },
              { text: buildUserPrompt(styles, examples) },
            ],
          },
        ],
        generationConfig: {
          temperature: 1,
          responseMimeType: 'application/json',
          responseSchema: buildResponseSchema(styles),
          ...thinkingConfig,
        },
      }),
    })
  } catch (error) {
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
      throw new CaptionModelError('The caption model is busy right now.', true)
    }
    throw error
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    console.error(`Gemini error ${response.status} (${model}):`, detail)
    // Busy, overloaded, or this model isn't available to this key: try another model.
    // This model isn't available to this key: try another model, and don't retry it.
    if (response.status === 404) {
      throw new CaptionModelError('The caption model is busy right now.', true, true)
    }
    // Busy or overloaded: try another model.
    if (response.status === 429 || response.status >= 500) {
      throw new CaptionModelError('The caption model is busy right now.', true)
    }
    if (response.status === 400 && /API key/i.test(detail)) {
      throw new CaptionModelError('The Gemini API key is not valid.')
    }
    throw new CaptionModelError(`The caption model rejected the request (${response.status}).`)
  }

  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
    promptFeedback?: { blockReason?: string }
  }
  if (body.promptFeedback?.blockReason) {
    throw new CaptionModelError('This photo could not be captioned.')
  }
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
  if (!text) throw new CaptionModelError('The caption model returned no captions.')
  const reply = parseCaptionReply(text, styles)
  if (reply.captions.length < styles.length) {
    console.warn(
      `Gemini (${model}) gave ${reply.captions.length} of ${styles.length} captions. ` +
        `Reply started: ${text.slice(0, 300)}`
    )
  }
  return reply
}

/**
 * Try each model in order until one answers. If every model is busy, wait a
 * moment and go through the list once more. Errors that another model can't
 * fix (an invalid API key, a blocked photo) stop right away.
 */
export async function writeCaptionsWithFallback(
  options: Omit<Parameters<typeof writeCaptionsWithGemini>[0], 'model'> & {
    models: string[]
    onAttempt?: (model: string) => Promise<void> | void
  },
  deps: {
    write?: typeof writeCaptionsWithGemini
    sleep?: (ms: number) => Promise<void>
  } = {}
): Promise<GeminiCaptionReply> {
  const { models, onAttempt, ...request } = options
  const write = deps.write ?? writeCaptionsWithGemini
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  let lastError: unknown = new CaptionModelError('The caption model is busy right now.', true)
  const missing = new Set<string>()

  for (let round = 0; round < 2; round++) {
    const available = models.filter((model) => !missing.has(model))
    if (available.length === 0) break
    if (round > 0) await sleep(5000)
    for (const model of available) {
      try {
        await onAttempt?.(model)
        return await write({ ...request, model })
      } catch (error) {
        if (!(error instanceof CaptionModelError && error.temporary)) throw error
        if (error.modelMissing) missing.add(model)
        console.warn(`Gemini model ${model} unavailable, trying the next one.`)
        lastError = error
      }
    }
  }
  throw lastError
}
