import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { isSupabaseEnabled, supabaseRest } from '../supabaseClient.js'
import { getInfraStatus } from '../infra/config.js'
import { testRedisConnection } from '../infra/redis.js'
import { readWorkerHeartbeat } from '../infra/workerHealth.js'
import {
  backfillAllPipelineShards,
  backfillOrganization,
  verifyPipelineLeadsBackfill,
} from '../pipelineLeadsBackfill.js'
import { runEnterpriseSupabaseSetup } from '../enterpriseSupabaseSetup.js'

function authorize(req, body) {
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  const authHeader = req.headers?.authorization || ''
  const provided =
    authHeader.replace(/^Bearer\s+/i, '') ||
    req.query?.secret ||
    body?.secret
  if (secret) return provided === secret
  return false
}

async function pipelineLeadsTableExists() {
  try {
    await supabaseRest('pipeline_leads?select=lead_id&limit=1', {}, { timeoutMs: 15_000, attempts: 1 })
    return { exists: true }
  } catch (error) {
    const msg = String(error?.message || '')
    if (/relation.*does not exist|42P01|not found|schema cache/i.test(msg)) {
      return { exists: false, error: msg }
    }
    throw error
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  const body = req.method === 'POST' ? getBody(req) : {}
  const action = body.action || req.query?.action || 'status'

  if (action !== 'status' && action !== 'enterprise-setup' && !authorize(req, body)) {
    return sendJson(res, 401, {
      error: 'Set CRON_SECRET on Vercel and pass Authorization: Bearer <secret>',
    })
  }

  if (!isSupabaseEnabled()) {
    return sendJson(res, 503, { error: 'Supabase not configured' })
  }

  if (action === 'status') {
    let redisTest = { ok: false, mode: 'skipped' }
    let worker = { ok: false, error: 'skipped' }
    try {
      ;[redisTest, worker] = await Promise.all([
        getInfraStatus().redis ? testRedisConnection() : Promise.resolve({ ok: false, mode: 'disabled' }),
        getInfraStatus().redis ? readWorkerHeartbeat() : Promise.resolve({ ok: false, error: 'redis_disabled' }),
      ])
    } catch (error) {
      redisTest = { ok: false, error: error?.message || String(error) }
    }
    const table = await pipelineLeadsTableExists()
    return sendJson(res, 200, {
      ok: true,
      infra: getInfraStatus(),
      redis: redisTest,
      worker,
      pipelineLeadsTable: table,
    })
  }

  if (action === 'verify') {
    const orgId = body.orgId || req.query?.orgId || null
    const report = await verifyPipelineLeadsBackfill({ orgId })
    return sendJson(res, report.ok ? 200 : 409, report)
  }

  if (action === 'backfill') {
    const table = await pipelineLeadsTableExists()
    if (!table.exists) {
      return sendJson(res, 503, {
        error: 'pipeline_leads table missing — run Supabase migration first',
        migration: 'supabase/migrations/20260609120000_pipeline_leads.sql',
      })
    }

    const orgId = body.orgId || req.query?.orgId || null
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    const result = orgId
      ? { shards: [await backfillOrganization(orgId, { dryRun })], shardCount: 1 }
      : await backfillAllPipelineShards({ dryRun })

    return sendJson(res, 200, { ok: true, dryRun, ...result })
  }

  if (action === 'enterprise-setup') {
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    const force = body.force === true || req.query?.force === '1'
    const result = await runEnterpriseSupabaseSetup({ dryRun, force })
    return sendJson(res, result.ok ? 200 : 409, result)
  }

  return sendJson(res, 400, {
    error: 'Unknown action',
    actions: ['status', 'verify', 'backfill', 'enterprise-setup'],
  })
}
