import { isoWeeksOverlappingMonth, resolveTimeZone } from '../calendarLocale.js'
import { normalizeCompanyMatchKey } from '../leadErp.js'
import { resolveLeadLastOrderCreatedAt } from '../leadLastOrder.js'
import { normalizeCrmLeadStatus } from '../crmLeadStatuses.js'

export function uniqueCustomerKey(entry) {
  const lead = entry?.lead || {}
  const company = normalizeCompanyMatchKey(lead.company)
  if (company) return `c:${company}`
  const id = lead.id || entry?.leadId || entry?.id
  if (id) return `id:${id}`
  const email = String(lead.email || '').trim().toLowerCase()
  if (email) return `e:${email}`
  return ''
}

export function uniqueCustomerLabel(entry) {
  const lead = entry?.lead || {}
  const company = String(lead.company || '').trim()
  if (company) return company
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return name || 'Unnamed customer'
}

function ownerIdOf(entry, rowOwnerId) {
  return String(entry?.assignedToUserId || rowOwnerId || '').trim() || 'unassigned'
}

function tagIdsOf(entry) {
  const ids = entry?.crm?.tagIds
  return Array.isArray(ids) ? ids.map(String) : []
}

function revenueOf(entry) {
  const n = Number(entry?.erp?.revenue?.revenue ?? entry?.lead?.erp?.revenue?.revenue)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function lastOrderMs(entry) {
  const iso = resolveLeadLastOrderCreatedAt({
    crm: entry?.crm,
    erp: entry?.erp || entry?.lead?.erp,
    lead: entry?.lead,
  })
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

export function matchUniqueCustomerFilters(entry, row, filters = {}) {
  const statuses = (filters.statuses || []).map(String).filter(Boolean)
  if (statuses.length) {
    const status = normalizeCrmLeadStatus(entry?.crm?.status || row?.lead_status)
    if (!statuses.includes(status) && !statuses.includes(String(row?.lead_status || ''))) return false
  }
  const tagIds = (filters.tagIds || []).map(String).filter(Boolean)
  if (tagIds.length) {
    const have = new Set(tagIdsOf(entry))
    if (!tagIds.some((id) => have.has(id))) return false
  }
  const ownerIds = (filters.ownerIds || []).map(String).filter(Boolean)
  if (ownerIds.length) {
    const oid = ownerIdOf(entry, row?.owner_id)
    if (!ownerIds.includes(oid)) return false
  }
  return true
}

function mergeCustomer(map, rec) {
  const prev = map.get(rec.key)
  if (!prev) {
    map.set(rec.key, rec)
    return
  }
  const later = rec.lastOrderMs != null && (prev.lastOrderMs == null || rec.lastOrderMs > prev.lastOrderMs)
  map.set(rec.key, {
    ...prev,
    lastOrderMs: later ? rec.lastOrderMs : prev.lastOrderMs,
    lastOrderAt: later ? rec.lastOrderAt : prev.lastOrderAt,
    leadId: later ? rec.leadId : prev.leadId,
    ownerId: later ? rec.ownerId : prev.ownerId,
    label: later ? rec.label : prev.label,
    revenue: Math.max(prev.revenue, rec.revenue),
  })
}

/**
 * Week-grid + owner-grouped customer list from pipeline entries.
 * Unique customer = one company (fallback lead). Counted in the week of lastOrderCreatedAt.
 */
export function buildUniqueCustomersReport(rows, { year, month, weeks = [], timeZone, ownerNames = {} } = {}) {
  const tz = resolveTimeZone({}, timeZone)
  const y = Number(year)
  const m = Number(month)
  const weekCatalog = y && m ? isoWeeksOverlappingMonth(y, m, tz) : []
  const weekFilter = (weeks || []).map(String).filter(Boolean)
  const columns = weekFilter.length
    ? weekCatalog.filter((w) => weekFilter.includes(String(w.week)))
    : weekCatalog

  const customers = new Map()
  for (const row of rows || []) {
    const entry = row.entry || row
    const lastMs = lastOrderMs(entry)
    if (lastMs == null) continue
    const key = uniqueCustomerKey(entry)
    if (!key) continue
    mergeCustomer(customers, {
      key,
      leadId: entry.lead?.id || row.lead_id,
      label: uniqueCustomerLabel(entry),
      ownerId: ownerIdOf(entry, row.owner_id),
      lastOrderMs: lastMs,
      lastOrderAt: new Date(lastMs).toISOString(),
      revenue: revenueOf(entry),
    })
  }

  const inColumns = [...customers.values()].filter((c) => {
    if (!columns.length) return true
    return columns.some((w) => c.lastOrderMs >= w.startMs && c.lastOrderMs < w.endMs)
  })

  const weekCells = columns.map((w) => {
    const inWeek = inColumns.filter((c) => c.lastOrderMs >= w.startMs && c.lastOrderMs < w.endMs)
    return {
      week: w.week,
      label: `W${w.week}`,
      uniqueCustomers: inWeek.length,
      revenue: inWeek.reduce((sum, c) => sum + c.revenue, 0),
    }
  })

  const totalUnique = inColumns.length
  const totalRevenue = inColumns.reduce((sum, c) => sum + c.revenue, 0)

  const groupsMap = new Map()
  for (const c of inColumns.sort((a, b) => a.label.localeCompare(b.label))) {
    const gid = c.ownerId
    const list = groupsMap.get(gid) || {
      ownerId: gid,
      ownerName: ownerNames[gid] || (gid === 'unassigned' ? 'Unassigned' : 'Team member'),
      customers: [],
      uniqueCustomers: 0,
      revenue: 0,
    }
    list.customers.push({
      leadId: c.leadId,
      name: c.label,
      uniqueCustomers: 1,
      revenue: c.revenue,
      lastOrderAt: c.lastOrderAt,
    })
    list.uniqueCustomers += 1
    list.revenue += c.revenue
    groupsMap.set(gid, list)
  }

  const groups = [...groupsMap.values()].sort((a, b) => b.uniqueCustomers - a.uniqueCustomers || a.ownerName.localeCompare(b.ownerName))

  return {
    year: y || null,
    month: m || null,
    weeks: weekCells,
    totals: { uniqueCustomers: totalUnique, revenue: totalRevenue },
    groups,
  }
}
