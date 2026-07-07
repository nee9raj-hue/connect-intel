import { listPipelineSavedEntries } from './organizations.js'
import { inferLeadCompanyDomain, normalizeCompanyDomain } from './companyDomain.js'

export function companyKey(lead) {
  const name = String(lead?.company || '').trim()
  if (!name) return null
  return name.toLowerCase()
}

export function companySlugId(key) {
  return String(key).replace(/[^a-z0-9]+/g, '_').slice(0, 80)
}

/**
 * Aggregate pipeline entries into company rows (shared in-memory + SQL sync).
 */
export function aggregateCompaniesFromEntries(entries) {
  const map = new Map()

  for (const entry of entries || []) {
    const lead = entry.lead || {}
    const key = companyKey(lead)
    if (!key) continue

    if (!map.has(key)) {
      map.set(key, {
        id: companySlugId(key),
        name: String(lead.company).trim(),
        domain: inferLeadCompanyDomain(lead),
        city: lead.city || null,
        leadCount: 0,
        openDeals: 0,
        wonDeals: 0,
        totalDealValue: 0,
        leadIds: [],
        statuses: {},
        lastActivityAt: null,
        topScore: 0,
        assignees: new Set(),
        parentCompanyId: null,
      })
    }

    const row = map.get(key)
    const domain = inferLeadCompanyDomain(lead)
    if (domain && !row.domain) row.domain = domain
    if (!row.city && lead.city) row.city = lead.city

    row.leadCount += 1
    if (lead.id) row.leadIds.push(lead.id)
    const crm = entry.crm || {}
    const status = crm.status || 'new'
    row.statuses[status] = (row.statuses[status] || 0) + 1
    row.topScore = Math.max(row.topScore, Number(crm.leadScore) || 0)
    if (entry.assignedToUserId) row.assignees.add(entry.assignedToUserId)

    for (const deal of crm.deals || []) {
      const amount = Number(deal.amount) || 0
      if (deal.wonAt) {
        row.wonDeals += 1
        row.totalDealValue += amount
      } else if (!deal.lostAt) {
        row.openDeals += 1
        row.totalDealValue += amount
      }
    }

    const activityAt =
      crm.lastCommunicationAt ||
      crm.lastEmailSentAt ||
      crm.updatedAt ||
      entry.updatedAt ||
      entry.createdAt
    if (activityAt && (!row.lastActivityAt || activityAt > row.lastActivityAt)) {
      row.lastActivityAt = activityAt
    }
  }

  const rows = [...map.values()]
  const byDomain = new Map()
  for (const row of rows) {
    const domain = normalizeCompanyDomain(row.domain)
    if (!domain) continue
    if (!byDomain.has(domain)) {
      byDomain.set(domain, row)
      continue
    }
    const primary = byDomain.get(domain)
    primary.leadCount += row.leadCount
    primary.leadIds.push(...row.leadIds)
    primary.openDeals += row.openDeals
    primary.wonDeals += row.wonDeals
    primary.totalDealValue += row.totalDealValue
    primary.topScore = Math.max(primary.topScore, row.topScore)
    for (const [status, count] of Object.entries(row.statuses)) {
      primary.statuses[status] = (primary.statuses[status] || 0) + count
    }
    if (row.name.length > primary.name.length) primary.name = row.name
    if (
      row.lastActivityAt &&
      (!primary.lastActivityAt || row.lastActivityAt > primary.lastActivityAt)
    ) {
      primary.lastActivityAt = row.lastActivityAt
    }
    const idx = rows.indexOf(row)
    if (idx >= 0) rows[idx] = null
  }

  return rows.filter(Boolean).map((r) => ({
    ...r,
    domain: normalizeCompanyDomain(r.domain),
    assigneeCount: r.assignees.size,
    assignees: undefined,
  }))
}

/**
 * Aggregate pipeline leads into account (company) rows.
 */
export function buildCompaniesHub(store, user, { search = '', limit = 50, offset = 0 } = {}) {
  const entries = listPipelineSavedEntries(store, user)
  let rows = aggregateCompaniesFromEntries(entries)

  const q = String(search || '').trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.domain && r.domain.toLowerCase().includes(q)) ||
        (r.city && r.city.toLowerCase().includes(q))
    )
  }

  rows.sort((a, b) => {
    if (b.leadCount !== a.leadCount) return b.leadCount - a.leadCount
    return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '')
  })

  const total = rows.length
  const companies = rows.slice(offset, offset + limit)

  return { companies, total, query: q }
}

export function getCompanyDetail(store, user, companyId) {
  const hub = buildCompaniesHub(store, user, { limit: 5000 })
  const company = hub.companies.find((c) => c.id === companyId)
  if (!company) return null

  const entries = listPipelineSavedEntries(store, user).filter((e) =>
    company.leadIds.includes(e.lead?.id)
  )

  const leads = entries.map((e) => ({
    id: e.lead?.id,
    name: e.lead?.name,
    email: e.lead?.email,
    phone: e.lead?.phone,
    status: e.crm?.status || 'new',
    leadScore: e.crm?.leadScore ?? null,
    assignedToUserId: e.assignedToUserId,
    lastActivityAt: e.crm?.lastCommunicationAt || e.updatedAt,
  }))

  return { ...company, leads }
}

export function getCompanyDetailForLeadIds(store, user, company, leadIds) {
  if (!company) return null
  const idSet = new Set((leadIds || company.leadIds || []).map(String))
  const entries = listPipelineSavedEntries(store, user).filter((e) =>
    idSet.has(String(e.lead?.id))
  )

  const leads = entries.map((e) => ({
    id: e.lead?.id,
    name: e.lead?.name,
    email: e.lead?.email,
    phone: e.lead?.phone,
    status: e.crm?.status || 'new',
    leadScore: e.crm?.leadScore ?? null,
    assignedToUserId: e.assignedToUserId,
    lastActivityAt: e.crm?.lastCommunicationAt || e.updatedAt,
  }))

  return { ...company, leads }
}

/** Attach parent names and child accounts for Accounts hub UI. */
export function enrichCompaniesHierarchy(companies) {
  const rows = (companies || []).map((c) => ({ ...c }))
  const byId = new Map(rows.map((c) => [String(c.id), c]))
  for (const row of rows) {
    const parentId = row.parentCompanyId ? String(row.parentCompanyId) : null
    row.parentName = parentId && byId.has(parentId) ? byId.get(parentId).name : null
    row.childCount = rows.filter((c) => String(c.parentCompanyId || '') === String(row.id)).length
    row.children = rows
      .filter((c) => String(c.parentCompanyId || '') === String(row.id))
      .map((c) => ({ id: c.id, name: c.name, leadCount: c.leadCount }))
  }
  return rows
}
