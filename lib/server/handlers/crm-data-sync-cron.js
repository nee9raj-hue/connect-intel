import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { isSupabaseEnabled, supabaseRest } from '../supabaseClient.js'
import { readStore } from '../store.js'
import { resolveOrganization } from '../orgCrmClean.js'
import {
  backfillAllPipelineShards,
  backfillOrganization,
  verifyPipelineLeadsBackfill,
} from '../pipelineLeadsBackfill.js'
import {
  backfillAllPipelineCompanies,
  backfillPipelineCompaniesForOrg,
  verifyPipelineCompaniesBackfill,
} from '../pipelineCompaniesBackfill.js'

function isCronAuthorized(req, body) {
  if (req.headers['x-vercel-cron'] === '1') return true
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  if (!secret) return false
  const authHeader = req.headers?.authorization || ''
  const provided =
    authHeader.replace(/^Bearer\s+/i, '') || req.query?.secret || body?.secret
  return provided === secret
}

async function pipelineLeadsTableExists() {
  try {
    await supabaseRest('pipeline_leads?select=lead_id&limit=1', {}, { timeoutMs: 15_000, attempts: 1 })
    return true
  } catch {
    return false
  }
}

async function pipelineCompaniesTableExists() {
  try {
    await supabaseRest('pipeline_companies?select=company_id&limit=1', {}, { timeoutMs: 15_000, attempts: 1 })
    return true
  } catch {
    return false
  }
}

async function resolveOrgId({ orgId, nameQuery }) {
  if (orgId) return orgId
  if (!nameQuery) return null
  const store = await readStore({ only: ['organizations'] })
  return resolveOrganization(store, { nameQuery }).id
}

async function runPipelineSync(orgId) {
  const verifyBefore = await verifyPipelineLeadsBackfill({ orgId })
  let backfill = null
  if (!verifyBefore.ok) {
    if (!(await pipelineLeadsTableExists())) {
      return { ok: false, error: 'pipeline_leads table missing', verifyBefore }
    }
    backfill = orgId
      ? { shards: [await backfillOrganization(orgId)], shardCount: 1 }
      : await backfillAllPipelineShards({ dryRun: false })
  }
  const verifyAfter = backfill ? await verifyPipelineLeadsBackfill({ orgId }) : verifyBefore
  return { ok: verifyAfter.ok, verifyBefore, backfill, verifyAfter }
}

async function runCompaniesSync(orgId) {
  const verifyBefore = await verifyPipelineCompaniesBackfill({ orgId })
  let backfill = null
  if (!verifyBefore.ok) {
    if (!(await pipelineCompaniesTableExists())) {
      return { ok: false, error: 'pipeline_companies table missing', verifyBefore }
    }
    backfill = orgId
      ? [await backfillPipelineCompaniesForOrg(orgId, { dryRun: false })]
      : await backfillAllPipelineCompanies({ dryRun: false, orgId })
  }
  const verifyAfter = backfill ? await verifyPipelineCompaniesBackfill({ orgId }) : verifyBefore
  return { ok: verifyAfter.ok, verifyBefore, backfill, verifyAfter }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  const body = req.method === 'POST' ? getBody(req) : {}
  if (!isCronAuthorized(req, body)) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  if (!isSupabaseEnabled()) {
    return sendJson(res, 503, { error: 'Supabase not configured' })
  }

  const orgIdParam = String(req.query?.org || req.query?.orgId || body?.orgId || '').trim() || null
  const nameQuery = String(req.query?.nameQuery || req.query?.name || body?.nameQuery || '').trim() || null

  try {
    const orgId = await resolveOrgId({ orgId: orgIdParam, nameQuery })
    const [pipeline, companies] = await Promise.all([
      runPipelineSync(orgId),
      runCompaniesSync(orgId),
    ])
    const ok = pipeline.ok !== false && companies.ok !== false
    return sendJson(res, ok ? 200 : 409, {
      ok,
      orgId,
      nameQuery,
      pipeline,
      companies,
    })
  } catch (err) {
    console.error('data sync cron failed:', err?.message || err)
    return sendJson(res, 500, { error: err.message || 'Data sync cron failed' })
  }
}
