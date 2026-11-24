/** Pure helpers for the Gemini prompt and reply (no network, easy to test). */

export type HumorStyle = { id: number; name: string; description: string }

export type WrittenCaption = { flavorId: number; text: string }

export type GeminiCaptionReply = {
  imageDescription: string
  captions: WrittenCaption[]
}

export const SYSTEM_PROMPT = [
  'You write captions for Crackd, a humor site where college students vote on the',
  'funniest captions for photos. Great Crackd captions are short (usually under 20',
  'words), relatable to student life, and often use formats like "Me when…",',
  '"POV:" or "When your…". Be playful and witty, never cruel.',
  'Never use slurs or sexual content, never joke about race, religion, gender,',
  'disability or other protected traits, and never guess who a real person in the',
  'photo is. Write in English and reply with JSON only.',
].join(' ')

/** Turn a humor_flavors row into a short style the model can follow. */
export function toHumorStyle(row: {
  id: number
  slug: string
  description: string | null
}): HumorStyle {
  const name = row.slug.replace(/[-_]+/g, ' ').trim()
  const description = (row.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 400)
  return { id: row.id, name, description }
}

/** Pinned styles first, then a random mix, up to `count`. */
export function chooseStyles<T extends { is_pinned: boolean }>(
  rows: T[],
  count: number,
  random: () => number = Math.random
): T[] {
  const shuffle = (items: T[]) =>
    items
      .map((item) => ({ item, key: random() }))
      .sort((a, b) => a.key - b.key)
      .map(({ item }) => item)
  const pinned = shuffle(rows.filter((row) => row.is_pinned))
  const others = shuffle(rows.filter((row) => !row.is_pinned))
  return [...pinned, ...others].slice(0, count)
}

/** The answer slot for the style at this position: s1, s2, s3… */
export const slotFor = (index: number) => `s${index + 1}`

export function buildUserPrompt(styles: HumorStyle[], examples: string[]): string {
  const styleLines = styles
    .map((style, index) =>
      style.description
        ? `- ${slotFor(index)}: ${style.name}. ${style.description}`
        : `- ${slotFor(index)}: ${style.name}`
    )
    .join('\n')
  const exampleLines = examples.length
    ? '\n\nCaptions that did well on Crackd (for tone only, do not copy them):\n' +
    examples.map((example) => `- ${example}`).join('\n')
    : ''
  return (
    'Look at the photo. First describe it in one plain sentence as image_description. ' +
    `Then write one caption for each of the ${styles.length} humor styles below, in that ` +
    'style. Put each caption in "captions" under its style\'s key (s1, s2, …). ' +
    'Every key must have its own different caption.\n\n' +
    `Humor styles:\n${styleLines}${exampleLines}`
  )
}

/**
 * JSON schema Gemini must follow (structured output). Each humor style gets its
 * own required key, so the model has to write a caption for every style and
 * never has to copy database ids.
 */
export function buildResponseSchema(styles: HumorStyle[]) {
  const keys = styles.map((_, index) => slotFor(index))
  return {
    type: 'OBJECT',
    properties: {
      image_description: { type: 'STRING' },
      captions: {
        type: 'OBJECT',
        properties: Object.fromEntries(keys.map((key) => [key, { type: 'STRING' }])),
        required: keys,
        propertyOrdering: keys,
      },
    },
    required: ['image_description', 'captions'],
    propertyOrdering: ['image_description', 'captions'],
  }
}

const cleanCaption = (value: unknown) =>
  typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, '')
    : ''

/**
 * Parse Gemini's JSON text into one caption per style, in the requested order.
 * Accepts the slot format ({ s1: "...", s2: "..." }) and, as a fallback, a list
 * of { flavor_id, caption }. Drops empty, overly long or repeated captions.
 */
export function parseCaptionReply(text: string, styles: HumorStyle[]): GeminiCaptionReply {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The caption model returned invalid JSON.')
  }
  const reply = (parsed ?? {}) as { image_description?: unknown; captions?: unknown }

  const byFlavor = new Map<number, string>()
  const seen = new Set<string>()
  const keep = (flavorId: number, value: unknown) => {
    const caption = cleanCaption(value)
    if (byFlavor.has(flavorId) || caption.length < 2 || caption.length > 300) return
    if (seen.has(caption.toLowerCase())) return
    seen.add(caption.toLowerCase())
    byFlavor.set(flavorId, caption)
  }

  if (Array.isArray(reply.captions)) {
    const ids = new Set(styles.map((style) => style.id))
    for (const item of reply.captions as Array<{ flavor_id?: unknown; caption?: unknown }>) {
      const flavorId = Number(item?.flavor_id)
      if (ids.has(flavorId)) keep(flavorId, item?.caption)
    }
  } else if (reply.captions && typeof reply.captions === 'object') {
    const slots = reply.captions as Record<string, unknown>
    styles.forEach((style, index) => keep(style.id, slots[slotFor(index)]))
  }

  const captions = styles
    .filter((style) => byFlavor.has(style.id))
    .map((style) => ({ flavorId: style.id, text: byFlavor.get(style.id)! }))
  const imageDescription = typeof reply.image_description === 'string'
    ? reply.image_description.replace(/\s+/g, ' ').trim().slice(0, 1000)
    : ''
  return { imageDescription, captions }
}
