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
import {
  backfillAllPipelineActivities,
  backfillPipelineActivitiesForOrg,
  verifyPipelineActivitiesBackfill,
} from '../pipelineActivitiesBackfill.js'
import {
  backfillAllPipelineDeals,
  backfillPipelineDealsForOrg,
  verifyPipelineDealsBackfill,
} from '../pipelineDealsBackfill.js'
import {
  backfillAllPipelineCrmEntities,
  backfillPipelineCrmEntitiesForOrg,
  verifyPipelineCrmEntitiesBackfill,
} from '../pipelineCrmEntitiesBackfill.js'
import { syncWorkerEnvToRailway } from '../railwayWorkerSync.js'
import {
  backfillAllPipelineCompanies,
  backfillPipelineCompaniesForOrg,
  verifyPipelineCompaniesBackfill,
} from '../pipelineCompaniesBackfill.js'
import {
  backfillAllMeilisearch,
  backfillMeilisearchForOrg,
  verifyMeilisearchBackfill,
} from '../meilisearchBackfill.js'
import { meiliEnabled, testMeilisearchConnection, meilisearchIndexStats } from '../meilisearch/client.js'
import { refreshDashboardSnapshotsForUser } from '../dashboardSnapshots.js'
import { readStore } from '../store.js'
import { runEnterpriseSupabaseSetup } from '../enterpriseSupabaseSetup.js'
import { probeMarketingSqlQueueTables } from '../marketingEmailQueue.js'
import { processMarketingEmailQueue } from '../marketingEmailQueueWorker.js'
import { assertFreshStartAuthorized, runFreshStartReset } from '../freshStartReset.js'
import { cleanOrganizationCrm } from '../orgCrmClean.js'
import { getOrganizationRoster, transferOrgAdmin } from '../orgMembershipAdmin.js'
import { syncAllOrganizationsToSql, syncAllMemberProfilesToSql } from '../orgSqlSync.js'
import { listOrganizationsNeedingSqlSync, listProfilesNeedingSqlSync } from '../orgSqlResolve.js'

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
    const marketingQueue = await probeMarketingSqlQueueTables().catch((error) => ({
      ok: false,
      error: error?.message || String(error),
    }))
    let meilisearch = { configured: meiliEnabled(), ok: false }
    if (meiliEnabled()) {
      const connection = await testMeilisearchConnection()
      const stats = await meilisearchIndexStats()
      meilisearch = { configured: true, ...connection, stats }
    }
    return sendJson(res, 200, {
      ok: true,
      infra: getInfraStatus(),
      redis: redisTest,
      worker,
      pipelineLeadsTable: table,
      marketingSqlQueue: marketingQueue,
      meilisearch,
    })
  }

  if (action === 'marketing-queue-drain') {
    const limit = Math.min(200, Math.max(1, Number(body.limit || req.query?.limit) || 50))
    const result = await processMarketingEmailQueue({ limit, maxMs: 240_000 })
    return sendJson(res, 200, result)
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

  if (action === 'pipeline-sync') {
    const orgId = body.orgId || req.query?.orgId || null
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    const verifyBefore = await verifyPipelineLeadsBackfill({ orgId })
    let backfill = null
    if (!verifyBefore.ok && !dryRun) {
      const table = await pipelineLeadsTableExists()
      if (!table.exists) {
        return sendJson(res, 503, {
          error: 'pipeline_leads table missing',
          verifyBefore,
        })
      }
      backfill = orgId
        ? { shards: [await backfillOrganization(orgId)], shardCount: 1 }
        : await backfillAllPipelineShards({ dryRun: false })
    }
    const verifyAfter = backfill ? await verifyPipelineLeadsBackfill({ orgId }) : verifyBefore
    return sendJson(res, 200, {
      ok: verifyAfter.ok,
      orgId: orgId || null,
      dryRun,
      verifyBefore,
      backfill,
      verifyAfter,
    })
  }

  if (action === 'deals-sync') {
    const orgId = body.orgId || req.query?.orgId || null
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    const verifyBefore = await verifyPipelineDealsBackfill({ orgId })
    let backfill = null
    if (!verifyBefore.ok && !dryRun) {
      try {
        await supabaseRest('pipeline_deals?select=deal_id&limit=1', {}, { timeoutMs: 15_000, attempts: 1 })
      } catch (error) {
        return sendJson(res, 503, {
          error: 'pipeline_deals table missing',
          hint: 'Run supabase/migrations/20260610120000_crm_relational_v3.sql and 20260629120000_pipeline_deals_deploy5.sql',
          verifyBefore,
          detail: error?.message || String(error),
        })
      }
      backfill = orgId
        ? [await backfillPipelineDealsForOrg(orgId, { dryRun: false })]
        : await backfillAllPipelineDeals({ dryRun: false, orgId })
    }
    const verifyAfter = backfill ? await verifyPipelineDealsBackfill({ orgId }) : verifyBefore
    return sendJson(res, 200, {
      ok: verifyAfter.ok,
      orgId: orgId || null,
      dryRun,
      verifyBefore,
      backfill,
      verifyAfter,
    })
  }

  if (action === 'railway-worker-sync') {
    const result = await syncWorkerEnvToRailway()
    return sendJson(res, result.ok ? 200 : 503, result)
  }

  if (action === 'tasks-meetings-migrate') {
    const migration = await applyPipelineTasksMeetingsBootstrap()
    let tableProbe = { ok: false }
    try {
      await supabaseRest('pipeline_tasks?select=task_id&limit=1', {}, { timeoutMs: 15_000, attempts: 1 })
      tableProbe = { ok: true }
    } catch (error) {
      tableProbe = { ok: false, error: error?.message || String(error) }
    }
    return sendJson(res, migration.applied || tableProbe.ok ? 200 : 503, {
      ok: migration.applied || tableProbe.ok,
      migration,
      tableProbe,
    })
  }

  if (action === 'tasks-meetings-sync') {
    const orgId = body.orgId || req.query?.orgId || null
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    const verifyBefore = await verifyPipelineCrmEntitiesBackfill({ orgId })
    let backfill = null
    if (!verifyBefore.ok && !dryRun) {
      let migration = null
      try {
        await supabaseRest('pipeline_tasks?select=task_id&limit=1', {}, { timeoutMs: 15_000, attempts: 1 })
      } catch (error) {
        migration = await applyPipelineTasksMeetingsBootstrap()
        if (!migration.applied) {
          return sendJson(res, 503, {
            error: 'pipeline_tasks table missing',
            hint: 'Run supabase/migrations/20260702130000_pipeline_tasks_meetings_bootstrap.sql in Supabase SQL editor, or set SUPABASE_DB_PASSWORD / SUPABASE_ACCESS_TOKEN on Vercel',
            verifyBefore,
            migration,
            detail: error?.message || String(error),
          })
        }
      }
      backfill = orgId
        ? [await backfillPipelineCrmEntitiesForOrg(orgId, { dryRun: false })]
        : await backfillAllPipelineCrmEntities({ dryRun: false, orgId })
    }
    const verifyAfter = backfill ? await verifyPipelineCrmEntitiesBackfill({ orgId }) : verifyBefore
    return sendJson(res, 200, {
      ok: verifyAfter.ok,
      orgId: orgId || null,
      dryRun,
      verifyBefore,
      backfill,
      verifyAfter,
    })
  }

  if (action === 'companies-sync') {
    const orgId = body.orgId || req.query?.orgId || null
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    const verifyBefore = await verifyPipelineCompaniesBackfill({ orgId })
    let backfill = null
    if (!verifyBefore.ok && !dryRun) {
      try {
        await supabaseRest('pipeline_companies?select=company_id&limit=1', {}, { timeoutMs: 15_000, attempts: 1 })
      } catch (error) {
        return sendJson(res, 503, {
          error: 'pipeline_companies table missing',
          hint: 'Run supabase/migrations/20260630200000_pipeline_companies_deploy6.sql',
          verifyBefore,
          detail: error?.message || String(error),
        })
      }
      backfill = orgId
        ? [await backfillPipelineCompaniesForOrg(orgId, { dryRun: false })]
        : await backfillAllPipelineCompanies({ dryRun: false, orgId })
    }
    const verifyAfter = backfill ? await verifyPipelineCompaniesBackfill({ orgId }) : verifyBefore
    return sendJson(res, 200, {
      ok: verifyAfter.ok,
      orgId: orgId || null,
      dryRun,
      verifyBefore,
      backfill,
      verifyAfter,
    })
  }

  if (action === 'meili-sync') {
    const orgId = body.orgId || req.query?.orgId || null
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    if (!meiliEnabled()) {
      return sendJson(res, 503, {
        error: 'Meilisearch not configured',
        hint: 'Set MEILI_HOST and MEILI_API_KEY on Vercel',
      })
    }
    const connection = await testMeilisearchConnection()
    if (!connection.ok) {
      return sendJson(res, 503, { ok: false, connection })
    }
    const verifyBefore = await verifyMeilisearchBackfill({ orgId })
    let backfill = null
    if (!verifyBefore.ok && !dryRun) {
      backfill = orgId
        ? await backfillMeilisearchForOrg(orgId)
        : await backfillAllMeilisearch({ orgId })
    }
    const verifyAfter = backfill ? await verifyMeilisearchBackfill({ orgId }) : verifyBefore
    return sendJson(res, 200, {
      ok: connection.ok && verifyAfter.ok,
      orgId: orgId || null,
      dryRun,
      connection,
      verifyBefore,
      backfill,
      verifyAfter,
    })
  }

  if (action === 'enterprise-setup') {
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    const force = body.force === true || req.query?.force === '1'
    const result = await runEnterpriseSupabaseSetup({ dryRun, force })
    return sendJson(res, result.ok ? 200 : 409, result)
  }

  if (action === 'org-sql-sync') {
    const orgId = body.orgId || req.query?.orgId || null
    const store = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
    const pending = listOrganizationsNeedingSqlSync(store)
    const profilesPending = listProfilesNeedingSqlSync(store, { orgId })
    const result = await syncAllOrganizationsToSql({ store, orgId })
    return sendJson(res, 200, {
      ok: true,
      orgId: orgId || null,
      pendingBefore: pending.length,
      profilesPendingBefore: profilesPending.length,
      ...result,
    })
  }

  if (action === 'profiles-sql-sync') {
    const orgId = body.orgId || req.query?.orgId || null
    const store = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
    const profilesPending = listProfilesNeedingSqlSync(store, { orgId })
    const result = await syncAllMemberProfilesToSql({ store, orgId })
    return sendJson(res, 200, {
      ok: true,
      orgId: orgId || null,
      profilesPendingBefore: profilesPending.length,
      ...result,
    })
  }

  if (action === 'org-roster') {
    const orgId = body.orgId || req.query?.orgId || null
    const nameQuery = body.nameQuery || req.query?.nameQuery || null
    const roster = await getOrganizationRoster({ orgId, nameQuery })
    return sendJson(res, 200, { ok: true, roster })
  }

  if (action === 'org-transfer-admin') {
    const dryRun = body.dryRun !== false && req.query?.dryRun !== '0'
    const orgId = body.orgId || req.query?.orgId || null
    const nameQuery = body.nameQuery || req.query?.nameQuery || null
    const fromEmail = body.fromEmail || req.query?.fromEmail || null
    const toEmail = body.toEmail || req.query?.toEmail || null
    const result = await transferOrgAdmin({ orgId, nameQuery, fromEmail, toEmail, dryRun })
    return sendJson(res, 200, result)
  }

  if (action === 'org-crm-clean') {
    const dryRun = body.dryRun !== false && req.query?.dryRun !== '0'
    const orgId = body.orgId || req.query?.orgId || null
    const nameQuery = body.nameQuery || req.query?.nameQuery || null
    const report = await cleanOrganizationCrm({ orgId, nameQuery, dryRun })
    return sendJson(res, report.ok ? 200 : 409, { ok: report.ok, dryRun, report })
  }

  if (action === 'fresh-start') {
    const dryRun = body.dryRun !== false && req.query?.dryRun !== '0'
    const preservePlatform =
      body.preservePlatform !== false && req.query?.preservePlatform !== '0'
    if (!dryRun) {
      const confirm =
        String(body.freshStartConfirm || process.env.FRESH_START_CONFIRM || '').toLowerCase() ===
        'yes'
      assertFreshStartAuthorized({ execute: true, confirm })
    }
    const report = await runFreshStartReset({ dryRun, preservePlatform })
    return sendJson(res, report.ok ? 200 : 409, { ok: report.ok, dryRun, report })
  }

  if (action === 'activities-verify') {
    const orgId = body.orgId || req.query?.orgId || null
    const report = await verifyPipelineActivitiesBackfill({ orgId })
    return sendJson(res, report.ok ? 200 : 409, report)
  }

  if (action === 'activities-backfill') {
    const orgId = body.orgId || req.query?.orgId || null
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    const result = orgId
      ? [await backfillPipelineActivitiesForOrg(orgId, { dryRun })]
      : await backfillAllPipelineActivities({ dryRun, orgId })
    return sendJson(res, 200, { ok: true, dryRun, results: result })
  }

  if (action === 'dash-warm') {
    const orgId = body.orgId || req.query?.orgId || null
    const store = await readStore({ only: ['organizations', 'users'] })
    const orgs = orgId
      ? (store.organizations || []).filter((o) => o.id === orgId)
      : store.organizations || []
    const warmed = []
    for (const org of orgs) {
      const admin =
        (store.users || []).find(
          (u) => u.organizationId === org.id && (u.orgRole === 'org_admin' || u.isOrgAdmin)
        ) || (store.users || []).find((u) => u.organizationId === org.id)
      if (!admin) {
        warmed.push({ organizationId: org.id, ok: false, error: 'no_admin_user' })
        continue
      }
      try {
        const result = await refreshDashboardSnapshotsForUser(admin, 'week')
        warmed.push({ organizationId: org.id, ok: true, entryCount: result?.entryCount ?? 0 })
      } catch (error) {
        warmed.push({ organizationId: org.id, ok: false, error: error?.message || String(error) })
      }
    }
    return sendJson(res, 200, { ok: true, warmed })
  }

  if (action === 'activity-log-setup') {
    const orgId = body.orgId || req.query?.orgId || null
    const dryRun = body.dryRun === true || req.query?.dryRun === '1'
    const steps = []

    let table = { ok: false }
    try {
      await supabaseRest('pipeline_activities?select=id&limit=1', {}, { timeoutMs: 15_000, attempts: 1 })
      table = { ok: true }
    } catch (error) {
      table = {
        ok: false,
        error: error?.message || String(error),
        hint: 'Run supabase/migrations/20260617120200_activity_log_table_and_rpc.sql once in Supabase SQL editor',
      }
    }
    steps.push({ step: 'pipeline_activities_table', ...table })

    let indexes = { ok: false, skipped: !table.ok }
    if (table.ok) {
      try {
        await supabaseRest(
          'rpc/ci_apply_activity_log_indexes',
          { method: 'POST', body: JSON.stringify({}) },
          { timeoutMs: 30_000, attempts: 1 }
        )
        indexes = { ok: true }
      } catch (error) {
        indexes = {
          ok: false,
          error: error?.message || String(error),
          hint: 'Run supabase/migrations/20260617120200_activity_log_table_and_rpc.sql in Supabase SQL editor once',
        }
      }
    }
    steps.push({ step: 'indexes', ...indexes })

    let backfill = []
    if (table.ok && !dryRun) {
      backfill = orgId
        ? [await backfillPipelineActivitiesForOrg(orgId, { dryRun })]
        : await backfillAllPipelineActivities({ dryRun, orgId })
    } else if (dryRun) {
      backfill = [{ skipped: true, reason: 'dry_run' }]
    } else {
      backfill = [{ skipped: true, reason: 'pipeline_activities_table_missing' }]
    }
    steps.push({ step: 'activities_backfill', dryRun, results: backfill })

    const store = await readStore({ only: ['organizations', 'users'] })
    const orgs = orgId
      ? (store.organizations || []).filter((o) => o.id === orgId)
      : store.organizations || []
    const warmed = []
    if (!dryRun) {
      for (const org of orgs) {
        const admin =
          (store.users || []).find(
            (u) => u.organizationId === org.id && (u.orgRole === 'org_admin' || u.isOrgAdmin)
          ) || (store.users || []).find((u) => u.organizationId === org.id)
        if (!admin) continue
        try {
          const result = await refreshDashboardSnapshotsForUser(admin, 'week')
          warmed.push({ organizationId: org.id, entryCount: result?.entryCount ?? 0 })
        } catch (error) {
          warmed.push({ organizationId: org.id, error: error?.message || String(error) })
        }
      }
    }
    steps.push({ step: 'dash_warm', dryRun, warmed })

    return sendJson(res, 200, { ok: true, dryRun, steps })
  }

  return sendJson(res, 400, {
    error: 'Unknown action',
    actions: [
      'status',
      'verify',
      'backfill',
      'pipeline-sync',
      'deals-sync',
      'companies-sync',
      'meili-sync',
      'enterprise-setup',
      'org-sql-sync',
      'profiles-sql-sync',
      'activities-verify',
      'activities-backfill',
      'dash-warm',
      'activity-log-setup',
      'fresh-start',
      'org-crm-clean',
      'org-roster',
      'org-transfer-admin',
    ],
  })
}
