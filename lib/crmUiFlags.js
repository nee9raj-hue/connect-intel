/**
 * Shared CRM UI gates (browser + server). Keep in sync with frontend/src/lib/crmProductFlags.js
 */

/** Full-page team intelligence (crm-dashboard, rep review, manager rollups). */
export const TEAM_INTELLIGENCE_IN_CRM_ENABLED = true

/** Org-wide activity log hub (crm-log). Per-lead timeline on LeadWorkspace stays on. */
export const ACTIVITY_LOG_HUB_IN_CRM_ENABLED = false

export function isTeamIntelligenceHubEnabled() {
  return TEAM_INTELLIGENCE_IN_CRM_ENABLED
}

export function isActivityLogHubEnabled() {
  return ACTIVITY_LOG_HUB_IN_CRM_ENABLED
}
