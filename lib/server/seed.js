import { BUILT_IN_LEAD_ROWS } from './built-in-leads.js'
import { importRowsIntoStore, MASTER_DATA_COLLECTIONS } from './imports.js'
import { readStore, updateStorePartial } from './store.js'

const BUILT_IN_MARKER = 'built-in-seed'
let builtInReady = false

export async function ensureBuiltInDatabase() {
  if (builtInReady) {
    return { seeded: false, skipped: true }
  }

  const store = await readStore({ only: MASTER_DATA_COLLECTIONS })
  const alreadySeeded =
    (store.importJobs || []).some((job) => job.sourceLabel === BUILT_IN_MARKER) ||
    (store.companies?.length || 0) > 12

  if (alreadySeeded) {
    builtInReady = true
    return { seeded: false, count: store.contacts?.length || 0, added: 0 }
  }

  const before = store.contacts?.length || 0
  const { store: next, importJob } = importRowsIntoStore(store, 'exporters', BUILT_IN_LEAD_ROWS, {
    email: 'system@connectintel.app',
  })
  importJob.sourceLabel = BUILT_IN_MARKER

  const added = (next.contacts?.length || 0) - before
  if (added > 0) {
    await updateStorePartial(MASTER_DATA_COLLECTIONS, () => next)
  }

  builtInReady = true
  return { seeded: added > 0, count: next.contacts?.length || 0, added }
}
