import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveStoreBackend } from './storeBackend.js'

describe('resolveStoreBackend', () => {
  const saved = {}

  function saveEnv() {
    for (const key of ['STORE_BACKEND', 'DATABASE_PROVIDER', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
      saved[key] = process.env[key]
    }
  }

  function restoreEnv() {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }

  it('defaults to sqlite without cloud env', () => {
    saveEnv()
    delete process.env.STORE_BACKEND
    delete process.env.DATABASE_PROVIDER
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    assert.equal(resolveStoreBackend(), 'sqlite')
    restoreEnv()
  })

  it('uses postgres when DATABASE_PROVIDER=postgres', () => {
    saveEnv()
    delete process.env.STORE_BACKEND
    process.env.DATABASE_PROVIDER = 'postgres'
    delete process.env.SUPABASE_URL
    assert.equal(resolveStoreBackend(), 'postgres')
    restoreEnv()
  })

  it('STORE_BACKEND overrides DATABASE_PROVIDER', () => {
    saveEnv()
    process.env.STORE_BACKEND = 'supabase-rest'
    process.env.DATABASE_PROVIDER = 'postgres'
    assert.equal(resolveStoreBackend(), 'supabase-rest')
    restoreEnv()
  })

  it('keeps supabase-rest when Supabase env is set and provider unset', () => {
    saveEnv()
    delete process.env.STORE_BACKEND
    delete process.env.DATABASE_PROVIDER
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    assert.equal(resolveStoreBackend(), 'supabase-rest')
    restoreEnv()
  })
})
