'use server'

import { fetchPopularCaptionsAction } from './fetch-popular-captions-action'

type Period = 'week' | 'past30' | 'year' | 'all'

const PERIOD_ORDER: Period[] = ['week', 'past30', 'year', 'all']

/**
 * For an empty time window, find the shortest longer window that has at least
 * one Top 100 caption. All longer windows are checked at the same time, so it
 * costs one round trip. Returns null when no window has captions.
 */
export const findCaptionWindowAction = async (emptyPeriod: Period): Promise<Period | null> => {
  const longer = PERIOD_ORDER.slice(PERIOD_ORDER.indexOf(emptyPeriod) + 1)

  const results = await Promise.all(
    longer.map(async (period) => {
      try {
        const captions = await fetchPopularCaptionsAction(1, period)
        return captions.length > 0
      } catch (error) {
        console.error(`Error checking ${period} captions:`, error)
        return false
      }
    })
  )

  const index = results.findIndex(Boolean)
  return index === -1 ? null : longer[index]
}
