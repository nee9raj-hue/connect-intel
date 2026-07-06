import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  SUPABASE_PROJECT_REF,
  buildPgConnectionString,
  buildPoolerConnectionString,
  extractPoolerHostFromEnv,
  isUsablePgUrl,
  normalizePgUrlForMigration,
  parsePgHost,
} from './supabaseSqlApply.js'

describe('supabaseSqlApply', () => {
  const saved = {}

  beforeEach(() => {
    for (const key of [
      'DATABASE_URL',
      'DIRECT_URL',
      'SUPABASE_DB_URL',
      'SUPABASE_DB_PASSWORD',
      'SUPABASE_DB_HOST',
      'SUPABASE_DB_PORT',
      'SUPABASE_REGION',
    ]) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('rejects legacy direct db host', () => {
    const url = `postgresql://postgres:secret@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`
    assert.equal(isUsablePgUrl(url), false)
  })

  it('normalizes pooler URL user and migration port', () => {
    process.env.SUPABASE_DB_PASSWORD = 'pw'
    const url = `postgresql://postgres:old@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`
    const out = normalizePgUrlForMigration(url)
    assert.match(out, /postgres\.hkdrannqcnszfukcqchj:pw@aws-1-ap-south-1\.pooler\.supabase\.com:5432/)
  })

  it('prefers DIRECT_URL over DATABASE_URL', () => {
    process.env.SUPABASE_DB_PASSWORD = 'pw'
    process.env.DATABASE_URL = 'postgresql://postgres:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
    process.env.DIRECT_URL = 'postgresql://postgres:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
    assert.equal(parsePgHost(buildPgConnectionString()), 'aws-1-ap-south-1.pooler.supabase.com')
  })

  it('extracts pooler host from DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://postgres.x:pw@aws-2-ap-south-1.pooler.supabase.com:6543/postgres'
    assert.equal(extractPoolerHostFromEnv()?.host, 'aws-2-ap-south-1.pooler.supabase.com')
  })

  it('builds pooler string without SUPABASE_URL', () => {
    const cs = buildPoolerConnectionString('secret', { host: 'aws-1-ap-south-1.pooler.supabase.com' })
    assert.match(cs, /postgres\.hkdrannqcnszfukcqchj:secret@aws-1-ap-south-1\.pooler\.supabase\.com:5432/)
  })
})
