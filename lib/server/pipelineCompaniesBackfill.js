import { pipelineOrgShardName, readPipelineShardEntries } from './pipelineShard.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { readStore } from './store.js'
import { aggregateCompaniesFromEntries } from './companiesHub.js'
import { listPipelineSavedEntries, buildOrgUserResponse } from './organizations.js'
import { pipelineCompaniesTableActive, syncPipelineCompaniesForOrg } from './pipelineCompaniesTable.js'

const COMPANIES_TABLE = 'pipeline_companies'

async function countCompaniesForOrg(orgId) {
  const rows = await supabaseRest(
    `${COMPANIES_TABLE}?organization_id=eq.${encodeURIComponent(orgId)}&select=company_id`,
    {},
    { timeoutMs: 30_000 }
  )
  return Array.isArray(rows) ? rows.length : 0
}

export async function backfillPipelineCompaniesForOrg(orgId, options = {}) {
  if (!isSupabaseEnabled() || !pipelineCompaniesTableActive()) {
    throw new Error('pipeline_companies table path disabled')
  }
  if (!orgId) throw new Error('orgId is required')

  const store = await readStore({ only: ['organizations', 'users', 'organizationMemberships'] })
  const org = (store.organizations || []).find((o) => o.id === orgId)
  const owner =
    (store.users || []).find((u) => u.organizationId === orgId && u.isOrgAdmin) ||
    (store.users || []).find((u) => u.organizationId === orgId)
  if (!owner) throw new Error('no org user for backfill')

  const user = buildOrgUserResponse({ ...owner, organizationId: orgId, accountType: 'company' }, store)
  const started = Date.now()
  const result = await syncPipelineCompaniesForOrg(user, store)
  return {
    organizationId: orgId,
    organizationName: org?.name || null,
    ...result,
    durationMs: Date.now() - started,
  }
}

export async function backfillAllPipelineCompanies(options = {}) {
  const store = await readStore({ only: ['organizations'] })
  const orgs = options.orgId
    ? (store.organizations || []).filter((o) => o.id === options.orgId)
    : store.organizations || []

  const results = []
  for (const org of orgs) {
    if (!org?.id) continue
    results.push(await backfillPipelineCompaniesForOrg(org.id, options))
  }
  return results
}

export async function verifyPipelineCompaniesBackfill({ orgId = null } = {}) {
  const store = await readStore({ only: ['organizations', 'users', 'organizationMemberships'] })
  const orgs = orgId
    ? (store.organizations || []).filter((o) => o.id === orgId)
    : store.organizations || []

  const checks = []
  for (const org of orgs) {
    const owner =
      (store.users || []).find((u) => u.organizationId === org.id && u.isOrgAdmin) ||
      (store.users || []).find((u) => u.organizationId === org.id)
    if (!owner) {
      checks.push({ organizationId: org.id, ok: false, error: 'no_owner' })
      continue
    }

    const user = buildOrgUserResponse(
      { ...owner, organizationId: org.id, accountType: 'company' },
      store
    )
    const shardName = pipelineOrgShardName(org.id)
    let entries = []
    try {
      entries = (await readPipelineShardEntries(shardName, { bypassCache: true })) || []
    } catch (error) {
      checks.push({ organizationId: org.id, ok: false, error: error?.message || String(error) })
      continue
    }

    const storeScoped = { ...store, savedLeads: entries }
    const visible = listPipelineSavedEntries(storeScoped, user)
    const memoryCount = aggregateCompaniesFromEntries(visible).length
    let tableCount = 0
    try {
      tableCount = await countCompaniesForOrg(org.id)
    } catch (error) {
      checks.push({ organizationId: org.id, ok: false, error: error?.message || String(error) })
      continue
    }

    checks.push({
      organizationId: org.id,
      ok: tableCount >= memoryCount,
      memoryCount,
      tableCount,
      leadCount: visible.length,
    })
  }

  return { ok: checks.every((c) => c.ok), checks }
}
