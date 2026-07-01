const STORAGE_PREFIX = 'ci-dashboard-layout:'

export const DASHBOARD_WIDGET_IDS = [
  'getting_started',
  'kpis',
  'pipeline',
  'analytics',
  'team_review',
  'priorities',
  'marketing',
  'activity',
  'sidebar',
]

export const DASHBOARD_WIDGET_LABELS = {
  getting_started: 'Getting started',
  kpis: 'Executive KPIs',
  pipeline: 'Sales pipeline',
  analytics: 'Analytics charts',
  team_review: 'Team review',
  priorities: 'My priorities',
  marketing: 'Recent campaigns',
  activity: 'Activity timeline',
  sidebar: 'Insights sidebar',
}

export function defaultDashboardLayout() {
  return DASHBOARD_WIDGET_IDS.map((id) => ({ id, visible: true }))
}

function normalizeLayout(raw) {
  const byId = new Map()
  for (const row of raw || []) {
    if (!row?.id || !DASHBOARD_WIDGET_IDS.includes(row.id)) continue
    byId.set(row.id, { id: row.id, visible: row.visible !== false })
  }
  const ordered = []
  for (const row of raw || []) {
    if (byId.has(row.id) && !ordered.some((o) => o.id === row.id)) {
      ordered.push(byId.get(row.id))
      byId.delete(row.id)
    }
  }
  for (const id of DASHBOARD_WIDGET_IDS) {
    if (byId.has(id)) ordered.push(byId.get(id))
  }
  return ordered.length ? ordered : defaultDashboardLayout()
}

export function readDashboardLayout(userId) {
  if (!userId || typeof localStorage === 'undefined') return defaultDashboardLayout()
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`)
    if (!raw) return defaultDashboardLayout()
    return normalizeLayout(JSON.parse(raw))
  } catch {
    return defaultDashboardLayout()
  }
}

export function writeDashboardLayout(userId, layout) {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(normalizeLayout(layout)))
  } catch {
    /* quota */
  }
}
