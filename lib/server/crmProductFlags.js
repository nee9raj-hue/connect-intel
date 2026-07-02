/**
 * CRM product flags (server). Keep in sync with lib/crmUiFlags.js
 */

/** Core CRM is free — no paid subscription, credits, or AI search quotas in the shell. */
export const CRM_SOLO_FREE_TIER = true

export const AI_PROSPECTING_IN_CRM_ENABLED = false

export {
  TEAM_INTELLIGENCE_IN_CRM_ENABLED,
  ACTIVITY_LOG_HUB_IN_CRM_ENABLED,
  isTeamIntelligenceHubEnabled,
  isActivityLogHubEnabled,
} from '../crmUiFlags.js'
