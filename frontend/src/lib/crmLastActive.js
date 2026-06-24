/** Pick the newest CRM timestamp when merging bootstrap + team-metrics rows. */
export function pickLatestCrmActivityAt(...values) {
  let max = 0
  let iso = null
  for (const raw of values) {
    if (!raw) continue
    const t = new Date(raw).getTime()
    if (!Number.isNaN(t) && t > max) {
      max = t
      iso = new Date(t).toISOString()
    }
  }
  return iso
}
