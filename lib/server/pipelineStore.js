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

export const DEFAULT_PIPELINE_PAGE_SIZE = 100
export const MAX_PIPELINE_PAGE_SIZE = 500
