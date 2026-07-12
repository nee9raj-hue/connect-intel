import { readStore, writeStoreCollections } from '../../../server/store.js'
import { isSupabaseEnabled, supabaseRest } from '../../../server/supabaseClient.js'
import { getPgPool, queryPg } from '../../../server/pgPool.js'
import { pingPostgresStore } from '../../../server/storePg.js'
import { resolveStoreBackend } from '../../../server/storeBackend.js'

/** Direct PostgreSQL — cloud-agnostic (Neon, Railway, Oracle, self-hosted). */
export function createPostgresDatabaseAdapter() {
  return {
    provider: 'postgres',
    storeBackend: resolveStoreBackend(),
    async query(sql, params = []) {
      return queryPg(sql, params)
    },
    async readStore(collections = null) {
      return readStore(collections ? { only: collections } : undefined)
    },
    async writeCollections(store, collections) {
      await writeStoreCollections(store, collections)
    },
    async ping() {
      if (resolveStoreBackend() === 'postgres') {
        return pingPostgresStore()
      }
      const pool = await getPgPool()
      await pool.query('SELECT 1')
      return true
    },
  }
}

/** Supabase PostgREST — legacy adapter; swap to postgres without changing repositories. */
export function createSupabaseRestDatabaseAdapter() {
  return {
    provider: 'supabase-rest',
    storeBackend: resolveStoreBackend(),
    async query(_sql, _params = []) {
      throw new Error('Raw SQL not supported on supabase-rest adapter — use postgres provider or repository methods')
    },
    async readStore(collections = null) {
      return readStore(collections ? { only: collections } : undefined)
    },
    async writeCollections(store, collections) {
      await writeStoreCollections(store, collections)
    },
    async ping() {
      if (!isSupabaseEnabled()) return false
      await supabaseRest('store_collections?select=collection&limit=1', {}, { timeoutMs: 15_000, attempts: 1 })
      return true
    },
  }
}

/** Local SQLite document store — docker dev / single-node MVP. */
export function createSqliteDatabaseAdapter() {
  return {
    provider: 'sqlite',
    storeBackend: resolveStoreBackend(),
    async query(_sql, _params = []) {
      throw new Error('Raw SQL on sqlite document store — set DATABASE_PROVIDER=postgres for SQL tables')
    },
    async readStore(collections = null) {
      return readStore(collections ? { only: collections } : undefined)
    },
    async writeCollections(store, collections) {
      await writeStoreCollections(store, collections)
    },
    async ping() {
      await readStore({ only: ['users'] })
      return true
    },
  }
}

export function createDatabaseAdapter(provider) {
  switch (provider) {
    case 'postgres':
      return createPostgresDatabaseAdapter()
    case 'sqlite':
      return createSqliteDatabaseAdapter()
    case 'supabase-rest':
    default:
      return createSupabaseRestDatabaseAdapter()
  }
}
