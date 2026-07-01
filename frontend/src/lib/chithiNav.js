import { CHITHI_IN_CRM_ENABLED } from './crmProductFlags'

/** Panel ids that render the Chithi team workspace (immersive layout). */
export const CHITHI_PANEL_IDS = new Set(['chithi', 'team-hub', 'team-notes', 'team-tasks'])

export function isChithiPanel(panel) {
  if (!CHITHI_IN_CRM_ENABLED) return false
  return CHITHI_PANEL_IDS.has(panel)
}

export function normalizeCrmPanel(panel) {
  if (!CHITHI_IN_CRM_ENABLED && CHITHI_PANEL_IDS.has(panel)) return 'overview'
  return panel
}
