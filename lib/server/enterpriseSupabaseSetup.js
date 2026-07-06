import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { isSupabaseEnabled, supabaseRest, fetchStoreCollectionJson, upsertCollection } from './supabaseClient.js'
import { backfillAllPipelineShards, verifyPipelineLeadsBackfill } from './pipelineLeadsBackfill.js'
import { backfillEnterpriseCrm } from './enterpriseCrmBackfill.js'
import { buildPgConnectionString } from './supabaseSqlApply.js'

const SETUP_COLLECTION = 'enterprise_setup_state'
const TABLE_NAMES = [
  'organizations',
  'profiles',
  'leads',
  'pipeline_leads',
  'store_collections',
]

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')

export async function probeEnterpriseTables() {
  const tables = {}
  for (const name of TABLE_NAMES) {
    try {
      await supabaseRest(`${name}?select=*&limit=1`, {}, { timeoutMs: 20_000, attempts: 1 })
      tables[name] = { exists: true }
    } catch (error) {
      const msg = String(error?.message || '')
      tables[name] = {
        exists: false,
        error: /does not exist|42P01|schema cache/i.test(msg) ? 'missing' : msg.slice(0, 160),
      }
    }
  }
  return tables
}

export async function testLeadPiiEncryption() {
  try {
    const sealed = await supabaseRest(
      'rpc/seal_lead_pii',
      { method: 'POST', body: JSON.stringify({ plaintext: 'setup-probe@connectintel.net' }) },
      { timeoutMs: 20_000, attempts: 1 }
    )
    if (!sealed) return { ok: false, error: 'seal_lead_pii returned empty' }

    const opened = await supabaseRest(
      'rpc/open_lead_pii',
      { method: 'POST', body: JSON.stringify({ sealed: typeof sealed === 'string' ? sealed : String(sealed) }) },
      { timeoutMs: 20_000, attempts: 1 }
    )
    const plain = typeof opened === 'string' ? opened : String(opened || '')
    return {
      ok: plain === 'setup-probe@connectintel.net',
      error: plain === 'setup-probe@connectintel.net' ? null : 'decrypt mismatch',
    }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

async function readSetupState() {
  try {
    const rows = await fetchStoreCollectionJson(SETUP_COLLECTION)
    return rows?.[0] && typeof rows[0] === 'object' ? rows[0] : null
  } catch {
    return null
  }
}

async function writeSetupState(state) {
  await upsertCollection(SETUP_COLLECTION, [{ ...state, updatedAt: new Date().toISOString() }])
}

async function applyMigrationSqlIfPossible() {
  if (!process.env.SUPABASE_DB_PASSWORD && !process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    return { applied: false, reason: 'no_database_url — run migration SQL once in Supabase or set SUPABASE_DB_PASSWORD' }
  }

  let pg
  try {
    pg = await import('pg')
  } catch {
    return { applied: false, reason: 'pg module not installed' }
  }

  const connectionString = buildPgConnectionString()
  if (!connectionString) {
    return { applied: false, reason: 'could not build database connection string' }
  }

  const sqlPath = join(ROOT, 'supabase/migrations/20260613120000_enterprise_crm_schema.sql')
  const sql = readFileSync(sqlPath, 'utf8')
  const client = new pg.default.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    return { applied: true }
  } finally {
    await client.end()
  }
}

export async function runEnterpriseSupabaseSetup({ dryRun = false, force = false } = {}) {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase is not configured on this runtime')
  }

  const prior = await readSetupState()
  if (prior?.status === 'complete' && !force) {
    return { ok: true, alreadyComplete: true, prior }
  }

  const steps = []
  const tables = await probeEnterpriseTables()
  steps.push({ step: 'probe_tables', tables })

  const enterpriseReady =
    tables.organizations?.exists && tables.profiles?.exists && tables.leads?.exists

  if (!enterpriseReady) {
    const migration = await applyMigrationSqlIfPossible()
    steps.push({ step: 'apply_migration', ...migration })
    if (!migration.applied) {
      const reprobe = await probeEnterpriseTables()
      steps.push({ step: 'reprobe_tables', tables: reprobe })
      if (!reprobe.organizations?.exists) {
        const state = {
          status: 'blocked',
          message:
            'Enterprise tables missing. Migration SQL must exist in Supabase (one-time). Vault secret must exist.',
          steps,
        }
        if (!dryRun) await writeSetupState(state)
        return { ok: false, ...state }
      }
    }
  }

  const encryption = await testLeadPiiEncryption()
  steps.push({ step: 'test_encryption', ...encryption })

  if (!encryption.ok) {
    const state = {
      status: 'blocked',
      message: 'Vault secret connect_intel_lead_pii missing or seal/open RPC not installed',
      steps,
    }
    if (!dryRun) await writeSetupState(state)
    return { ok: false, ...state }
  }

  if (tables.pipeline_leads?.exists && !dryRun) {
    const pipeline = await backfillAllPipelineShards({ dryRun: false })
    steps.push({ step: 'pipeline_leads_backfill', ...pipeline })
    const verify = await verifyPipelineLeadsBackfill({})
    steps.push({ step: 'pipeline_leads_verify', ...verify })
  } else {
    steps.push({ step: 'pipeline_leads_backfill', skipped: true, reason: tables.pipeline_leads?.exists ? 'dry_run' : 'table_missing' })
  }

  if (!dryRun) {
    const enterprise = await backfillEnterpriseCrm({ dryRun: false })
    steps.push({ step: 'enterprise_crm_backfill', ...enterprise })
  } else {
    const preview = await backfillEnterpriseCrm({ dryRun: true })
    steps.push({ step: 'enterprise_crm_backfill', dryRun: true, ...preview })
  }

  const enterpriseStep = steps.find((s) => s.step === 'enterprise_crm_backfill')
  const pipelineStep = steps.find((s) => s.step === 'pipeline_leads_backfill')
  const counts = {
    organizations: enterpriseStep?.orgs ?? null,
    profiles: enterpriseStep?.profiles ?? null,
    leads: enterpriseStep?.leads ?? null,
    pipeline_leads: pipelineStep?.upserted ?? pipelineStep?.totalUpserted ?? null,
  }
  steps.push({ step: 'counts', counts })

  const state = {
    status: dryRun ? 'dry_run' : 'complete',
    steps,
    counts,
  }
  if (!dryRun) await writeSetupState(state)

  return { ok: true, ...state }
}
