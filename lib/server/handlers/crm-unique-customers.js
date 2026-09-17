import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { readStore } from '../store.js'
import { isSupabaseEnabled, supabaseRest } from '../supabaseClient.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import { resolveViewerRoleFlags } from '../dashboardRoleScope.js'
import { resolveManagerVisibleOwnerIds } from '../pipelineManagerScope.js'
import { dealPeriodWindows } from '../../pipelineDealsFilter.js'
import { buildOwnerMemberIndex } from '../../erpOwner.js'
import { pipelineLastOrderPeriodOr } from '../pipelineDashboardPeriod.js'
import {
  buildUniqueCustomersReport,
  matchUniqueCustomerFilters,
} from '../uniqueCustomersDashboard.js'

const META = ['users', 'organizations', 'organizationMemberships']
const PAGE = 400

function csv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function ownerNameMap(store, orgId) {
  const names = { unassigned: 'Unassigned' }
  for (const m of store.organizationMemberships || []) {
    if (orgId && m.organizationId !== orgId) continue
    const user = (store.users || []).find((u) => u.id === m.userId)
    names[m.userId] = user?.name || user?.email || 'Team member'
  }
  return names
}

async function loadFactRows({ organizationId, ownerIds, sinceIso, untilIso }) {
  const rows = []
  let offset = 0
  for (;;) {
    const parts = [
      `organization_id=eq.${encodeURIComponent(organizationId)}`,
      'select=lead_id,owner_id,lead_status,entry',
      'order=lead_id.asc',
      `limit=${PAGE}`,
      `offset=${offset}`,
    ]
    if (ownerIds?.length === 1) {
      parts.push(`owner_id=eq.${encodeURIComponent(ownerIds[0])}`)
    } else     if (ownerIds?.length > 1) {
      parts.push(`owner_id=in.(${ownerIds.map(encodeURIComponent).join(',')})`)
    }
    const periodOr = pipelineLastOrderPeriodOr(sinceIso, untilIso)
    if (periodOr) parts.push(periodOr)
    const page = await supabaseRest(`pipeline_leads?${parts.join('&')}`, {}, { timeoutMs: 45_000 })
    const list = Array.isArray(page) ? page : []
    rows.push(...list)
    if (list.length < PAGE) break
    offset += list.length
    if (offset > 20_000) break
  }
  return rows
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return
  if (!user.organizationId) {
    return sendJson(res, 200, {
      weeks: [],
      totals: { uniqueCustomers: 0, revenue: 0 },
      groups: [],
    })
  }
  if (!isSupabaseEnabled()) {
    return sendJson(res, 503, { error: 'Database is not configured' })
  }

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const timeZone = resolveTimeZone(user, params.get('tz'))
  const year = Number(params.get('year')) || new Date().getFullYear()
  const month = Number(params.get('month')) || 0
  const weeks = csv(params.get('weeks'))
  const tagIds = csv(params.get('tagIds'))
  const statuses = csv(params.get('statuses'))
  const ownerFilter = csv(params.get('ownerIds'))

  const metaStore = await readStore({ only: META })
  const { isAdmin, isRep } = resolveViewerRoleFlags(user, metaStore)
  const visibleOwners = await resolveManagerVisibleOwnerIds(user, metaStore)
  let scopeOwners = null
  if (isRep) scopeOwners = [String(user.id)]
  else if (!isAdmin && Array.isArray(visibleOwners)) scopeOwners = visibleOwners.map(String)

  const windows = dealPeriodWindows({ year, month: month || undefined, weeks }, timeZone)
  const sinceIso = windows[0] ? new Date(Math.min(...windows.map((w) => w.start))).toISOString() : null
  const untilIso = windows[0] ? new Date(Math.max(...windows.map((w) => w.end))).toISOString() : null
  const ownerIndex = buildOwnerMemberIndex(metaStore, user.organizationId)
  const ownerNames = { ...ownerNameMap(metaStore, user.organizationId), ...ownerIndex.names }

  try {
    const raw = await loadFactRows({
      organizationId: user.organizationId,
      ownerIds: scopeOwners,
      sinceIso,
      untilIso,
    })
    const filtered = raw.filter((row) =>
      matchUniqueCustomerFilters(
        row.entry,
        row,
        { tagIds, statuses, ownerIds: ownerFilter },
        ownerIndex
      )
    )
    const report = buildUniqueCustomersReport(filtered, {
      year,
      month: month || undefined,
      weeks,
      timeZone,
      ownerNames,
      ownerIndex,
    })
    return sendJson(res, 200, report)
  } catch (err) {
    console.error('unique customers dashboard:', err?.message || err)
    return sendJson(res, 500, { error: err.message || 'Could not load unique customers' })
  }
}
