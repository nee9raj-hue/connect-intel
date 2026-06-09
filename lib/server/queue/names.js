/** BullMQ queue names — one worker pool per workload class. */

export const QUEUE_NAMES = {
  EMAIL: 'ci-email',
  AUTOMATION: 'ci-automation',
  IMPORT: 'ci-import',
  EXPORT: 'ci-export',
  ANALYTICS: 'ci-analytics',
  NOTIFICATION: 'ci-notification',
  SEARCH_INDEX: 'ci-search-index',
}

export const JOB_TYPES = {
  EMAIL_CAMPAIGN_BURST: 'email.campaign_burst',
  EMAIL_PIPELINE_BULK: 'email.pipeline_bulk',
  AUTOMATION_RUN: 'automation.run',
  IMPORT_CHUNK: 'import.chunk',
  EXPORT_BUILD: 'export.build',
  ANALYTICS_DASHBOARD: 'analytics.dashboard_refresh',
  ANALYTICS_PIPELINE_INDEX: 'analytics.pipeline_index',
  SEARCH_UPSERT_LEADS: 'search.upsert_leads',
  SEARCH_DELETE_ORG: 'search.delete_org',
}
