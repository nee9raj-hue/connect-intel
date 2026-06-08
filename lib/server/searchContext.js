import { MASTER_DATA_COLLECTIONS } from './imports.js'
import { getExcludedPipelineLeadIds, isPlatformOperatorUser } from './organizations.js'
import { readStore } from './store.js'
import { fetchStoreCollectionJson } from './supabaseClient.js'

const SEARCH_MASTER_COLLECTIONS = [...MASTER_DATA_COLLECTIONS, 'leadUnlocks']
const SEARCH_USER_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

/** Load only what search needs — parallel reads, skip pipeline blob for platform operators. */
export async function loadSearchContext(viewer) {
  const isOperator = isPlatformOperatorUser(viewer)

  const [master, orgUsers, savedLeads] = await Promise.all([
    readStore({ only: SEARCH_MASTER_COLLECTIONS }),
    readStore({ only: SEARCH_USER_COLLECTIONS }),
    isOperator ? Promise.resolve([]) : fetchStoreCollectionJson('savedLeads').catch(() => []),
  ])

  const store = {
    ...master,
    ...orgUsers,
    savedLeads: Array.isArray(savedLeads) ? savedLeads : [],
  }

  const excludeIds = isOperator ? new Set() : getExcludedPipelineLeadIds(store, viewer)
  return { store, excludeIds, isOperator }
}
