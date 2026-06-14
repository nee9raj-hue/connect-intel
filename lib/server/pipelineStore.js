/** Collections needed for pipeline list / CRM views (avoid loading full store). */
export const PIPELINE_STORE_COLLECTIONS = [
  'savedLeads',
  'users',
  'organizations',
  'organizationMemberships',
]

/** Collections touched by CSV/Excel pipeline import. */
export const PIPELINE_IMPORT_STORE_COLLECTIONS = [
  'companies',
  'contacts',
  'savedLeads',
  'importJobs',
]

export const DEFAULT_PIPELINE_PAGE_SIZE = 50
export const MAX_PIPELINE_PAGE_SIZE = 500
/** Switch pipeline UI to server-side filter/pagination above this total. */
export const SERVER_SIDE_PIPELINE_THRESHOLD = 120
