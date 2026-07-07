import { isPipelineLeadsTableEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { aggregateCompaniesFromEntries } from './companiesHub.js'
import { listPipelineSavedEntries } from './organizations.js'
import { readStore } from './store.js'
import { pipelineShardNameForUser, readPipelineShardEntries } from './pipelineShard.js'
import { readPipelineLeadsForUser } from './pipelineLeadsTable.js'

const TABLE = 'pipeline_companies'
const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

export function isPipelineCompaniesTableEnabled() {
  return isPipelineLeadsTableEnabled() && isSupabaseEnabled()
}

export function pipelineCompaniesTableActive() {
  return isPipelineCompaniesTableEnabled()
}

function companyRowToSql(organizationId, company) {
  const {
    id,
    name,
    domain,
    city,
    leadCount,
    openDeals,
    wonDeals,
    totalDealValue,
    leadIds,
    statuses,
    lastActivityAt,
    topScore,
    assigneeCount,
    parentCompanyId,
  } = company

  return {
    organization_id: String(organizationId),
    company_id: String(id),
    name: name || null,
    domain: domain || null,
    parent_company_id: parentCompanyId || null,
    metadata: {
      city: city || null,
      leadCount: leadCount || 0,
      openDeals: openDeals || 0,
      wonDeals: wonDeals || 0,
      totalDealValue: totalDealValue || 0,
      leadIds: leadIds || [],
      statuses: statuses || {},
      lastActivityAt: lastActivityAt || null,
      topScore: topScore || 0,
      assigneeCount: assigneeCount || 0,
    },
    updated_at: lastActivityAt || new Date().toISOString(),
  }
}

function sqlRowToCompany(row) {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  return {
    id: row.company_id,
    name: row.name || '',
    domain: row.domain || null,
    parentCompanyId: row.parent_company_id || meta.parentCompanyId || null,
    city: meta.city || null,
    leadCount: meta.leadCount || 0,
    openDeals: meta.openDeals || 0,
    wonDeals: meta.wonDeals || 0,
    totalDealValue: meta.totalDealValue || 0,
    leadIds: meta.leadIds || [],
    statuses: meta.statuses || {},
    lastActivityAt: meta.lastActivityAt || null,
    topScore: meta.topScore || 0,
    assigneeCount: meta.assigneeCount || 0,
  }
}

export async function orgHasPipelineCompanies(organizationId) {
  if (!organizationId || !pipelineCompaniesTableActive()) return false
  try {
    const rows = await supabaseRest(
      `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&select=company_id&limit=1`,
      {},
      { timeoutMs: 10_000, attempts: 1 }
    )
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

async function loadEntriesForOrgSync(user, metaStore) {
  const shardName = pipelineShardNameForUser(user)
  const fromTable = await readPipelineLeadsForUser(user, metaStore, shardName, {})
  if (fromTable?.length) {
    const store = { ...metaStore, savedLeads: fromTable }
    return listPipelineSavedEntries(store, user)
  }
  const shardEntries = await readPipelineShardEntries(shardName, { bypassCache: true })
  const store = { ...metaStore, savedLeads: shardEntries || [] }
  return listPipelineSavedEntries(store, user)
}

export async function syncPipelineCompaniesForOrg(user, metaStoreHint = null) {
  if (!pipelineCompaniesTableActive() || !user?.organizationId) return { synced: 0 }

  const metaStore =
    metaStoreHint || (await readStore({ only: META_STORE_COLLECTIONS }))
  const entries = await loadEntriesForOrgSync(user, metaStore)
  const companies = aggregateCompaniesFromEntries(entries)
  const organizationId = user.organizationId

  const rows = companies.map((c) => companyRowToSql(organizationId, c))
  const keepIds = new Set(companies.map((c) => String(c.id)))

  if (rows.length) {
    await supabaseRest(
      `${TABLE}?on_conflict=organization_id,company_id`,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      },
      { timeoutMs: 60_000 }
    )
  }

  const existing = await supabaseRest(
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&select=company_id`,
    {},
    { timeoutMs: 20_000 }
  )
  if (Array.isArray(existing)) {
    for (const row of existing) {
      if (row.company_id && !keepIds.has(String(row.company_id))) {
        await supabaseRest(
          `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
            `&company_id=eq.${encodeURIComponent(row.company_id)}`,
          { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
          { timeoutMs: 15_000 }
        )
      }
    }
  }

  return { synced: rows.length, companies }
}

export async function listPipelineCompaniesPage(
  organizationId,
  { search = '', limit = 50, offset = 0 } = {}
) {
  if (!organizationId || !pipelineCompaniesTableActive()) return null

  const lim = Math.min(100, Math.max(1, Number(limit) || 50))
  const off = Math.max(0, Number(offset) || 0)
  const q = String(search || '').trim()

  let path =
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
    `&select=company_id,name,domain,metadata,updated_at` +
    `&order=updated_at.desc`

  if (q) {
    const pattern = encodeURIComponent(`%${q}%`)
    path += `&or=(name.ilike.${pattern},domain.ilike.${pattern},metadata->>city.ilike.${pattern})`
  }

  path += `&limit=${lim}&offset=${off}`

  const rows = await supabaseRest(path, {}, { timeoutMs: 20_000 })
  if (!Array.isArray(rows)) return null

  let companies = rows.map(sqlRowToCompany)
  companies.sort((a, b) => {
    if (b.leadCount !== a.leadCount) return b.leadCount - a.leadCount
    return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '')
  })

  const countPath = `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&select=company_id`
  const all = await supabaseRest(countPath, {}, { timeoutMs: 30_000 })
  const total = Array.isArray(all) ? all.length : companies.length

  return {
    companies,
    total: q ? companies.length : total,
    query: q.toLowerCase(),
    fromCompaniesTable: true,
  }
}

export async function getPipelineCompanyById(organizationId, companyId) {
  if (!organizationId || !companyId || !pipelineCompaniesTableActive()) return null

  const rows = await supabaseRest(
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&company_id=eq.${encodeURIComponent(companyId)}` +
      `&select=company_id,name,domain,metadata,updated_at&limit=1`,
    {},
    { timeoutMs: 15_000 }
  )
  if (!Array.isArray(rows) || !rows[0]) return null
  return sqlRowToCompany(rows[0])
}
