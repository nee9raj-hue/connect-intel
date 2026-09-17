import { isoWeeksOverlappingMonth, resolveTimeZone } from '../calendarLocale.js'
import { uniqueCustomerKey, uniqueCustomerLabel } from './uniqueCustomersDashboard.js'
import {
  dashboardSalesOwnerId,
  erpOnboardedAtIso,
} from '../erpOwner.js'

function parseMs(value) {
  if (!value) return null
  const ms = Date.parse(String(value))
  return Number.isFinite(ms) ? ms : null
}

export function onboardedAtMs(entry) {
  return parseMs(erpOnboardedAtIso(entry))
}

export function teamIdOf(entry, row, ownerIndex, ownerTeamMap = {}) {
  const ownerId = dashboardSalesOwnerId(entry, ownerIndex)
  if (ownerId && ownerId !== 'unassigned' && ownerTeamMap[ownerId]) {
    return String(ownerTeamMap[ownerId])
  }
  if (ownerId === 'unassigned') return 'unassigned'
  return String(entry?.teamId || row?.team_id || '').trim() || 'unassigned'
}

export function matchOnboardingRetentionFilters(entry, row, filters = {}, ownerIndex, ownerTeamMap) {
  const ownerIds = (filters.ownerIds || []).map(String).filter(Boolean)
  if (ownerIds.length) {
    const oid = dashboardSalesOwnerId(entry, ownerIndex)
    if (!ownerIds.includes(oid)) return false
  }
  const teamIds = (filters.teamIds || []).map(String).filter(Boolean)
  if (teamIds.length) {
    const tid = teamIdOf(entry, row, ownerIndex, ownerTeamMap)
    if (!teamIds.includes(tid)) return false
  }
  return true
}

function mergeCustomer(map, rec) {
  const prev = map.get(rec.key)
  if (!prev) {
    map.set(rec.key, rec)
    return
  }
  const earlier =
    rec.onboardedMs != null && (prev.onboardedMs == null || rec.onboardedMs < prev.onboardedMs)
  map.set(rec.key, earlier ? rec : prev)
}

function flattenTeamCatalog(catalog = []) {
  return (catalog || [])
    .map((t) => ({
      teamId: String(t.teamId || t.id || '').trim(),
      teamName: String(t.teamName || t.name || t.label || '').trim() || 'Team',
    }))
    .filter((t) => t.teamId)
}

/**
 * Unique companies counted in the week they were onboarded from ERP
 * (first shipment, else customer created), grouped by the owner's team.
 */
export function buildOnboardingRetentionReport(
  rows,
  {
    year,
    month,
    weeks = [],
    timeZone,
    teamNames = {},
    teamCatalog = [],
    ownerIndex,
    ownerTeamMap = {},
  } = {}
) {
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
    const onboardedMs = onboardedAtMs(entry)
    if (onboardedMs == null) continue
    const key = uniqueCustomerKey(entry)
    if (!key) continue
    mergeCustomer(customers, {
      key,
      leadId: entry.lead?.id || row.lead_id,
      label: uniqueCustomerLabel(entry),
      ownerId: dashboardSalesOwnerId(entry, ownerIndex),
      teamId: teamIdOf(entry, row, ownerIndex, ownerTeamMap),
      onboardedMs,
      onboardedAt: new Date(onboardedMs).toISOString(),
    })
  }

  const inColumns = [...customers.values()].filter((c) => {
    if (!columns.length) return true
    return columns.some((w) => c.onboardedMs >= w.startMs && c.onboardedMs < w.endMs)
  })

  const weekCells = columns.map((w) => {
    const inWeek = inColumns.filter((c) => c.onboardedMs >= w.startMs && c.onboardedMs < w.endMs)
    return {
      week: w.week,
      label: `W${w.week}`,
      onboarded: inWeek.length,
    }
  })

  const names = { unassigned: 'Unassigned', ...teamNames }
  const catalog = flattenTeamCatalog(teamCatalog)
  const teamIds = new Set(catalog.map((t) => t.teamId))
  for (const c of inColumns) teamIds.add(c.teamId)
  if (!catalog.length && inColumns.some((c) => c.teamId === 'unassigned')) teamIds.add('unassigned')
  if (catalog.length && inColumns.some((c) => c.teamId === 'unassigned')) teamIds.add('unassigned')

  const orderedIds = [
    ...catalog.map((t) => t.teamId),
    ...[...teamIds].filter((id) => !catalog.some((t) => t.teamId === id)),
  ]

  const catalogName = Object.fromEntries(catalog.map((t) => [t.teamId, t.teamName]))

  const teams = orderedIds.map((teamId) => {
    const members = inColumns.filter((c) => c.teamId === teamId)
    const weekCounts = columns.map((w) => ({
      week: w.week,
      onboarded: members.filter((c) => c.onboardedMs >= w.startMs && c.onboardedMs < w.endMs).length,
    }))
    return {
      teamId,
      teamName: catalogName[teamId] || names[teamId] || (teamId === 'unassigned' ? 'Unassigned' : 'Team'),
      weeks: weekCounts,
      onboarded: members.length,
    }
  })

  return {
    year: y || null,
    month: m || null,
    weeks: weekCells,
    teams,
    totals: { onboarded: inColumns.length },
  }
}
