/** Panel ids that render the Chithi team workspace (immersive layout). */
export const CHITHI_PANEL_IDS = new Set(['chithi', 'team-hub', 'team-notes', 'team-tasks'])

export function isChithiPanel(panel) {
  return CHITHI_PANEL_IDS.has(panel)
}
