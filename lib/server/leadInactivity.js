import { pipelineEntryFreshness } from './pipelineShard.js'

const MS_DAY = 86_400_000

/** Whole days since last pipeline / CRM activity on a lead row. */
export function leadInactiveDays(entry) {
  const lastMs = pipelineEntryFreshness(entry)
  if (!lastMs) return Number.POSITIVE_INFINITY
  return Math.floor((Date.now() - lastMs) / MS_DAY)
}

export function leadMatchesInactivityThreshold(entry, thresholdDays) {
  const threshold = Math.max(1, Number(thresholdDays) || 7)
  return leadInactiveDays(entry) >= threshold
}
