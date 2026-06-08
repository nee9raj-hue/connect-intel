const STORAGE_KEY = 'ci_team_intel_return'

export function saveTeamIntelReturn({ period, memberUserId, timelineFilter, activityId, scrollY } = {}) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        period: period || 'week',
        memberUserId: memberUserId ? String(memberUserId) : '',
        timelineFilter: timelineFilter || 'all',
        activityId: activityId || null,
        scrollY: scrollY ?? (typeof window !== 'undefined' ? window.scrollY : 0),
        savedAt: Date.now(),
      })
    )
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadTeamIntelReturn() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearTeamIntelReturn() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function hasTeamIntelReturn() {
  return Boolean(loadTeamIntelReturn())
}
