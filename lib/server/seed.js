import { BUILT_IN_LEAD_ROWS } from './built-in-leads.js'
import { importRowsIntoStore } from './imports.js'
import { readStore, writeStore } from './store.js'

export async function ensureBuiltInDatabase() {
  const store = await readStore()
  const before = store.contacts.length

  const { store: next } = importRowsIntoStore(store, 'exporters', BUILT_IN_LEAD_ROWS, {
    email: 'system@connectintel.app',
  })

  const added = next.contacts.length - before
  if (added > 0) {
    await writeStore(next)
    return { store: next, seeded: true, count: next.contacts.length, added }
  }

  return { store: next, seeded: false, count: next.contacts.length, added: 0 }
}
