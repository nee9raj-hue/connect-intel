/** BullMQ queue names — one worker pool per workload class. */

export const QUEUE_NAMES = {
  EMAIL: 'ci-email',
  EMAIL_DLQ: 'ci-email-dlq',
  AUTOMATION: 'ci-automation',
  IMPORT: 'ci-import',
  EXPORT: 'ci-export',
  ANALYTICS: 'ci-analytics',
  NOTIFICATION: 'ci-notification',
  SEARCH_INDEX: 'ci-search-index',
}

export const JOB_TYPES = {
  EMAIL_CAMPAIGN_SEND: 'email.campaign_send',
  EMAIL_CAMPAIGN_BURST: 'email.campaign_burst',
  EMAIL_PIPELINE_BULK: 'email.pipeline_bulk',
  AUTOMATION_RUN: 'automation.run',
  IMPORT_CHUNK: 'import.chunk',
  EXPORT_BUILD: 'export.build',
  ANALYTICS_DASHBOARD: 'analytics.dashboard_refresh',
  ANALYTICS_DASHBOARD_SNAPSHOT: 'analytics.dashboard_snapshot',
  ANALYTICS_PIPELINE_INDEX: 'analytics.pipeline_index',
  SEARCH_UPSERT_LEADS: 'search.upsert_leads',
  SEARCH_SYNC_ORG: 'search.sync_org',
  SEARCH_DELETE_ORG: 'search.delete_org',
}
