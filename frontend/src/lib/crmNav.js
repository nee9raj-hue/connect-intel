import {
  AI_PROSPECTING_IN_CRM_ENABLED,
  CHITHI_IN_CRM_ENABLED,
  TEAM_INTELLIGENCE_IN_CRM_ENABLED,
  ACTIVITY_LOG_HUB_IN_CRM_ENABLED,
} from './crmProductFlags'

/** Panel ids that render the Chithi team workspace (immersive layout). */
export const CHITHI_PANEL_IDS = new Set(['chithi', 'team-hub', 'team-notes', 'team-tasks'])

/** AI prospecting panels (People Search, saved DB list). */
export const PROSPECTING_PANEL_IDS = new Set(['search', 'saved'])

/** Manager analytics panels — off for core CRM constitution. */
export const TEAM_INTELLIGENCE_PANEL_IDS = new Set(['crm-dashboard', 'crm-rep-review'])

export function isChithiPanel(panel) {
  if (!CHITHI_IN_CRM_ENABLED) return false
  return CHITHI_PANEL_IDS.has(panel)
}

export function isProspectingPanel(panel) {
  if (!AI_PROSPECTING_IN_CRM_ENABLED) return false
  return PROSPECTING_PANEL_IDS.has(panel)
}

/** Redirect disabled shell panels to Home. */
export function normalizeCrmPanel(panel) {
  const id = String(panel || 'overview').trim() || 'overview'
  if (!CHITHI_IN_CRM_ENABLED && CHITHI_PANEL_IDS.has(id)) return 'overview'
  if (!AI_PROSPECTING_IN_CRM_ENABLED && PROSPECTING_PANEL_IDS.has(id)) return 'overview'
  if (!TEAM_INTELLIGENCE_IN_CRM_ENABLED && TEAM_INTELLIGENCE_PANEL_IDS.has(id)) return 'overview'
  if (!ACTIVITY_LOG_HUB_IN_CRM_ENABLED && id === 'crm-log') return 'overview'
  return id
}
