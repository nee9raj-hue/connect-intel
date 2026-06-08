import { MASTER_DATA_COLLECTIONS } from './imports.js'
import { getExcludedPipelineLeadIds, isPlatformOperatorUser } from './organizations.js'
import { readStore } from './store.js'
import { fetchStoreCollectionJson } from './supabaseClient.js'

const SEARCH_MASTER_COLLECTIONS = [...MASTER_DATA_COLLECTIONS, 'leadUnlocks']
const SEARCH_USER_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']
const MASTER_CACHE_MS = 45_000
const PIPELINE_INDEX_TIMEOUT_MS = 8_000
const MASTER_READ_TIMEOUT_MS = 35_000

let masterCache = { at: 0, snapshot: null }

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    }),
  ])
}

async function loadMasterSlice() {
  const now = Date.now()
  if (masterCache.snapshot && now - masterCache.at < MASTER_CACHE_MS) {
    return masterCache.snapshot
  }
  const snapshot = await withTimeout(
    readStore({ only: SEARCH_MASTER_COLLECTIONS }),
    MASTER_READ_TIMEOUT_MS,
    'Master database read'
  )
  masterCache = { at: now, snapshot }
  return snapshot
}

/** Load only what search needs — parallel reads, skip pipeline blob for platform operators. */
export async function loadSearchContext(viewer) {
  const isOperator = isPlatformOperatorUser(viewer)

  const pipelinePromise = isOperator
    ? Promise.resolve([])
    : withTimeout(fetchStoreCollectionJson('savedLeads'), PIPELINE_INDEX_TIMEOUT_MS, 'Pipeline index').catch(
        () => []
      )

  const [master, orgUsers, savedLeads] = await Promise.all([
    loadMasterSlice(),
    readStore({ only: SEARCH_USER_COLLECTIONS }),
    pipelinePromise,
  ])

  const store = {
    ...master,
    ...orgUsers,
    savedLeads: Array.isArray(savedLeads) ? savedLeads : [],
  }

  const excludeIds = isOperator ? new Set() : getExcludedPipelineLeadIds(store, viewer)
  return { store, excludeIds, isOperator }
}
