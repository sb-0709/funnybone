/**
 * Turn caption-pipeline errors into messages people can act on, instead of
 * technical text like "API base URL is not defined." or "API request failed: 503".
 */
export type FriendlyCaptionError = {
  /** "unavailable" errors get a "Browse photos" next step in the UI. */
  kind: 'unavailable' | 'busy' | 'upload' | 'no_captions' | 'other'
  title: string
  description: string
}

const UNAVAILABLE: FriendlyCaptionError = {
  kind: 'unavailable',
  title: "Caption generation isn't available right now",
  description:
    'You can still browse: pick a photo under "Start with a banger" to see captions ' +
    'other people made, or try again later.',
}

export function friendlyCaptionError(error: unknown): FriendlyCaptionError {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''

  if (
    /API base URL|isn't set up|not configured|\(503\)|failed: 503|API key is not valid/i.test(
      message
    )
  ) {
    return UNAVAILABLE
  }
  if (/sign in again/i.test(message)) {
    return { kind: 'other', title: 'Please sign in again', description: message }
  }
  if (/busy|\(429\)|failed: 429|lot of captions|current captions to finish/i.test(message)) {
    return {
      kind: 'busy',
      title: 'Crackd is busy right now',
      description: /lot of captions|current captions to finish/i.test(message)
        ? message
        : 'Too many captions are being written at once. Please wait a minute and try again.',
    }
  }
  if (/upload failed|didn't upload|prepare the upload|save your photo/i.test(message)) {
    return {
      kind: 'upload',
      title: "Your photo didn't upload",
      description:
        'Check your connection and try again. Photos must be JPG, PNG, WEBP or HEIC, ' +
        'up to 10 MB.',
    }
  }
  // Messages the caption service already wrote for people: show them as they are.
  if (
    /JPG, PNG|valid image link|larger than 10 MB|could not be found|taking longer/i.test(message)
  ) {
    return { kind: 'other', title: "We couldn't use this photo", description: message }
  }
  if (/No captions could be generated|could not be captioned|returned no captions/i.test(message)) {
    return {
      kind: 'no_captions',
      title: "We couldn't write captions for this photo",
      description: 'Try again in a moment, or try a different photo.',
    }
  }
  return {
    kind: 'other',
    title: 'Something went wrong',
    description: "We couldn't make captions this time. Please try again.",
  }
}
