import crypto from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { isProduction } from './config.js'
import {
  fetchAllCollections,
  isSupabaseEnabled,
  upsertCollection,
} from './supabaseClient.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolveDataDir()
const DB_FILE = path.join(DATA_DIR, 'connect-intel.sqlite')
const LEGACY_STORE_FILE = path.join(DATA_DIR, 'store.json')
const COLLECTIONS = [
  'users',
  'organizations',
  'organizationMemberships',
  'sessions',
  'savedLeads',
  'searches',
  'importJobs',
  'companies',
  'contacts',
  'leadUnlocks',
  'creditLedger',
  'organizationInvites',
  'platform',
]

const DEFAULT_STORE = {
  users: [],
  organizations: [],
  organizationMemberships: [],
  sessions: [],
  savedLeads: [],
  searches: [],
  importJobs: [],
  companies: [],
  contacts: [],
  leadUnlocks: [],
  creditLedger: [],
  organizationInvites: [],
  platform: [{ inviteGmailOAuth: null }],
}

let database = null
let updateChain = Promise.resolve()

function resolveDataDir() {
  if (process.env.CONNECT_INTEL_DATA_DIR) {
    return process.env.CONNECT_INTEL_DATA_DIR
  }

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), 'connect-intel-data')
  }

  return path.resolve(__dirname, '../../data')
}

function cloneDefaultStore() {
  return JSON.parse(JSON.stringify(DEFAULT_STORE))
}

function mergeStore(raw) {
  return {
    ...cloneDefaultStore(),
    ...(raw || {}),
  }
}

function ensureDatabase() {
  if (database) return database

  mkdirSync(DATA_DIR, { recursive: true })
  const db = new DatabaseSync(DB_FILE)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_store (
      collection TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
  `)

  const existingCollections = db
    .prepare('SELECT collection FROM app_store')
    .all()
    .map((row) => row.collection)

  if (existingCollections.length === 0 && existsSync(LEGACY_STORE_FILE)) {
    try {
      const legacy = mergeStore(JSON.parse(readFileSync(LEGACY_STORE_FILE, 'utf8') || '{}'))
      const insert = db.prepare(
        'INSERT INTO app_store (collection, json) VALUES (?, ?) ON CONFLICT(collection) DO UPDATE SET json = excluded.json'
      )
      for (const collection of COLLECTIONS) {
        insert.run(collection, JSON.stringify(legacy[collection] || []))
      }
    } catch {
      // If legacy migration fails, fall back to seeded empty collections below.
    }
  }

  const insertDefault = db.prepare(
    'INSERT INTO app_store (collection, json) VALUES (?, ?) ON CONFLICT(collection) DO NOTHING'
  )
  for (const collection of COLLECTIONS) {
    insertDefault.run(collection, JSON.stringify(DEFAULT_STORE[collection] || []))
  }

  database = db
  return db
}

function readCollection(db, collection) {
  const row = db.prepare('SELECT json FROM app_store WHERE collection = ?').get(collection)
  if (!row?.json) return cloneDefaultStore()[collection]

  try {
    return JSON.parse(row.json)
  } catch {
    return cloneDefaultStore()[collection]
  }
}

function writeCollections(db, store) {
  const snapshot = mergeStore(store)
  const statement = db.prepare(
    'INSERT INTO app_store (collection, json) VALUES (?, ?) ON CONFLICT(collection) DO UPDATE SET json = excluded.json'
  )

  db.exec('BEGIN')
  try {
    for (const collection of COLLECTIONS) {
      statement.run(collection, JSON.stringify(snapshot[collection] || []))
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

async function readSupabaseStore() {
  const rows = await fetchAllCollections()
  const store = {}
  for (const collection of COLLECTIONS) {
    store[collection] = cloneDefaultStore()[collection]
  }
  for (const row of rows) {
    if (COLLECTIONS.includes(row.collection) && row.json != null) {
      store[row.collection] = row.json
    }
  }
  return mergeStore(store)
}

async function writeSupabaseStore(store) {
  const snapshot = mergeStore(store)
  await Promise.all(
    COLLECTIONS.map((collection) => upsertCollection(collection, snapshot[collection] || []))
  )
}

async function readSqliteStore() {
  const db = ensureDatabase()
  const store = {}
  for (const collection of COLLECTIONS) {
    store[collection] = readCollection(db, collection)
  }
  return mergeStore(store)
}

async function writeSqliteStore(store) {
  const db = ensureDatabase()
  writeCollections(db, store)
}

/** One-time copy: local/SQLite data → Supabase when cloud store is empty. */
export async function migrateSqliteToSupabaseIfNeeded() {
  if (!isSupabaseEnabled()) return { migrated: false }

  const cloud = await readSupabaseStore()
  const hasCloudData =
    (cloud.contacts?.length || 0) > 0 ||
    (cloud.companies?.length || 0) > 0 ||
    (cloud.users?.length || 0) > 0

  if (hasCloudData) return { migrated: false }

  const local = await readSqliteStore()
  const hasLocalData =
    (local.contacts?.length || 0) > 0 ||
    (local.companies?.length || 0) > 0 ||
    (local.users?.length || 0) > 0

  if (!hasLocalData) return { migrated: false }

  await writeSupabaseStore(local)
  return { migrated: true, contacts: local.contacts?.length || 0 }
}

function isServerlessCloud() {
  return Boolean(process.env.VERCEL) || isProduction()
}

async function readSupabaseStoreWithRetry(attempts = 3) {
  let lastError = null
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await readSupabaseStore()
    } catch (error) {
      lastError = error
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (i + 1)))
      }
    }
  }
  throw lastError || new Error('Supabase read failed')
}

/** Prevent accidental wipe when a bad read returned an almost-empty store. */
function assertSafeWrite(before, after) {
  const prevLeads = before.savedLeads?.length || 0
  const nextLeads = after.savedLeads?.length || 0
  const prevUsers = before.users?.length || 0
  const nextUsers = after.users?.length || 0

  if (prevLeads >= 3 && nextLeads < prevLeads * 0.4) {
    throw new Error(
      'Refusing to save: pipeline data would be lost (transient database read). Refresh and try again.'
    )
  }
  if (prevUsers >= 2 && nextUsers < prevUsers * 0.5 && nextUsers <= 1) {
    throw new Error(
      'Refusing to save: user accounts would be lost (transient database read). Refresh and try again.'
    )
  }
}

export async function readStore() {
  if (isSupabaseEnabled()) {
    await migrateSqliteToSupabaseIfNeeded()
    try {
      return await readSupabaseStoreWithRetry()
    } catch (error) {
      console.error('Supabase readStore failed:', error.message)
      if (isServerlessCloud()) {
        throw new Error(
          `Database unavailable (${error.message}). Your data is safe in Supabase — retry in a moment.`
        )
      }
    }
  }

  if (isServerlessCloud()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on Vercel. Data cannot be stored in ephemeral server memory.'
    )
  }

  return readSqliteStore()
}

export async function writeStore(store) {
  const snapshot = mergeStore(store)

  if (isSupabaseEnabled()) {
    try {
      const before = await readSupabaseStoreWithRetry()
      assertSafeWrite(before, snapshot)
      await writeSupabaseStore(snapshot)
      return
    } catch (error) {
      console.error('Supabase writeStore failed:', error.message)
      throw new Error(`Database save failed: ${error.message}`)
    }
  }

  if (isServerlessCloud()) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on Vercel.')
  }

  await writeSqliteStore(snapshot)
}

export async function updateStore(mutator) {
  updateChain = updateChain.then(async () => {
    const current = await readStore()
    const next = (await mutator(current)) || current
    await writeStore(next)
    return mergeStore(next)
  })

  return updateChain
}

export function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`
}

export async function getStoreMetadata() {
  if (isSupabaseEnabled()) {
    const { testSupabaseConnection } = await import('./supabaseClient.js')
    const test = await testSupabaseConnection()
    if (test.ok) {
      return { engine: 'supabase' }
    }
    return { engine: 'sqlite', supabaseFallbackReason: test.error }
  }
  return {
    engine: 'sqlite',
    path: DB_FILE,
  }
}
