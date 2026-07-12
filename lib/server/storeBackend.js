/**
 * Document store backend selection — P2 Infrastructure V2.
 * Production default unchanged: supabase-rest when Supabase env is set.
 */

import { isSupabaseEnabled } from './supabaseClient.js'

function cleanEnv(name) {
  const raw = process.env[name]
  if (!raw) return ''
  return String(raw).trim().replace(/^["']|["']$/g, '').toLowerCase()
}

/** @returns {'postgres' | 'supabase-rest' | 'sqlite'} */
export function resolveStoreBackend() {
  const explicit = cleanEnv('STORE_BACKEND')
  if (explicit === 'postgres' || explicit === 'supabase-rest' || explicit === 'sqlite') {
    return explicit
  }

  const dbProvider = cleanEnv('DATABASE_PROVIDER')
  if (dbProvider === 'postgres') return 'postgres'
  if (dbProvider === 'sqlite') return 'sqlite'
  if (dbProvider === 'supabase-rest') return 'supabase-rest'

  if (isSupabaseEnabled()) return 'supabase-rest'
  return 'sqlite'
}

export function isPostgresStoreBackend() {
  return resolveStoreBackend() === 'postgres'
}

export function isSupabaseRestStoreBackend() {
  return resolveStoreBackend() === 'supabase-rest'
}

export function isSqliteStoreBackend() {
  return resolveStoreBackend() === 'sqlite'
}
