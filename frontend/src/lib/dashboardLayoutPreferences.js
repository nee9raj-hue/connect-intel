import {
  DASHBOARD_WIDGET_IDS,
  DASHBOARD_WIDGET_LABELS,
  defaultDashboardLayout,
  normalizeDashboardLayout,
} from '../../../lib/dashboardLayout.js'

const STORAGE_PREFIX = 'ci-dashboard-layout:'

export { DASHBOARD_WIDGET_IDS, DASHBOARD_WIDGET_LABELS, defaultDashboardLayout }

export function normalizeLayout(raw) {
  return normalizeDashboardLayout(raw)
}

export function readDashboardLayout(userId) {
  if (!userId || typeof localStorage === 'undefined') return defaultDashboardLayout()
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`)
    if (!raw) return defaultDashboardLayout()
    return normalizeDashboardLayout(JSON.parse(raw))
  } catch {
    return defaultDashboardLayout()
  }
}

export function writeDashboardLayout(userId, layout) {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(normalizeDashboardLayout(layout)))
  } catch {
    /* quota */
  }
}
