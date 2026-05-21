import { BUILT_IN_LEAD_ROWS } from './built-in-leads.js'
import { importRowsIntoStore } from './imports.js'
import { readStore, writeStore } from './store.js'

let seedDone = false

export async function ensureBuiltInDatabase() {
  if (seedDone) {
    const store = await readStore()
    return { store, seeded: false }
  }

  const store = await readStore()
  if (store.contacts?.length > 0) {
    seedDone = true
    return { store, seeded: false }
  }

  seedDone = true

  const { store: next } = importRowsIntoStore(store, 'exporters', BUILT_IN_LEAD_ROWS, {
    email: 'system@connectintel.app',
  })

  await writeStore(next)
  return { store: next, seeded: true, count: next.contacts.length }
}
