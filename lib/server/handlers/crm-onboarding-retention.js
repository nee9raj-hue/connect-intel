import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { readStore } from '../store.js'
import { isSupabaseEnabled, supabaseRest } from '../supabaseClient.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import { resolveViewerRoleFlags } from '../dashboardRoleScope.js'
import { resolveManagerVisibleOwnerIds } from '../pipelineManagerScope.js'
import { dealPeriodWindows } from '../../pipelineDealsFilter.js'
import { listOrgHierarchy, loadMemberProfilesMap } from '../orgHierarchy.js'
import { buildOwnerMemberIndex } from '../../erpOwner.js'
import { pipelineOnboardedPeriodOr } from '../pipelineDashboardPeriod.js'
import {
  buildOnboardingRetentionReport,
  matchOnboardingRetentionFilters,
} from '../onboardingRetentionDashboard.js'

const META = ['users', 'organizations', 'organizationMemberships']
const PAGE = 400

function csv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function flattenTeams(hierarchy) {
  const catalog = []
  const names = { unassigned: 'Unassigned' }
  for (const dept of hierarchy?.departments || []) {
    for (const team of dept.teams || []) {
      const id = String(team.id)
      const label = dept.name ? `${team.name} (${dept.name})` : team.name
      catalog.push({ teamId: id, teamName: label })
      names[id] = label
    }
  }
  return { catalog, names }
}

async function loadFactRows({ organizationId, ownerIds, teamIds, sinceIso, untilIso }) {
  const rows = []
  let offset = 0
  const dateOr = pipelineOnboardedPeriodOr(sinceIso, untilIso)
  for (;;) {
    const parts = [
      `organization_id=eq.${encodeURIComponent(organizationId)}`,
      'select=lead_id,owner_id,team_id,entry',
      'order=lead_id.asc',
      `limit=${PAGE}`,
      `offset=${offset}`,
    ]
    if (ownerIds?.length === 1) {
      parts.push(`owner_id=eq.${encodeURIComponent(ownerIds[0])}`)
    } else if (ownerIds?.length > 1) {
      parts.push(`owner_id=in.(${ownerIds.map(encodeURIComponent).join(',')})`)
    }
    if (teamIds?.length === 1) {
      parts.push(`team_id=eq.${encodeURIComponent(teamIds[0])}`)
    } else if (teamIds?.length > 1) {
      parts.push(`team_id=in.(${teamIds.map(encodeURIComponent).join(',')})`)
    }
    if (dateOr) parts.push(dateOr)
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
      teams: [],
      totals: { onboarded: 0 },
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
  const ownerFilter = csv(params.get('ownerIds'))
  const teamFilter = csv(params.get('teamIds'))

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
  const profileMap = await loadMemberProfilesMap(user.organizationId).catch(() => ({}))
  const ownerTeamMap = Object.fromEntries(
    Object.entries(profileMap)
      .filter(([, p]) => p?.teamId)
      .map(([uid, p]) => [uid, String(p.teamId)])
  )

  let hierarchy = { departments: [] }
  try {
    hierarchy = await listOrgHierarchy(user.organizationId, { skipLeadCounts: true })
  } catch {
    hierarchy = { departments: [] }
  }
  const { catalog, names } = flattenTeams(hierarchy)
  const teamCatalog = teamFilter.length
    ? catalog.filter((t) => teamFilter.includes(t.teamId))
    : catalog

  try {
    let raw
    try {
      raw = await loadFactRows({
        organizationId: user.organizationId,
        ownerIds: scopeOwners,
        teamIds: null,
        sinceIso,
        untilIso,
      })
    } catch (dateErr) {
      console.warn('onboarding retention date filter fallback:', dateErr?.message || dateErr)
      raw = await loadFactRows({
        organizationId: user.organizationId,
        ownerIds: scopeOwners,
        teamIds: null,
        sinceIso: null,
        untilIso: null,
      })
    }
    const filtered = raw.filter((row) =>
      matchOnboardingRetentionFilters(
        row.entry,
        row,
        { ownerIds: ownerFilter, teamIds: teamFilter },
        ownerIndex,
        ownerTeamMap
      )
    )
    const report = buildOnboardingRetentionReport(filtered, {
      year,
      month: month || undefined,
      weeks,
      timeZone,
      teamNames: names,
      teamCatalog,
      ownerIndex,
      ownerTeamMap,
    })
    return sendJson(res, 200, report)
  } catch (err) {
    console.error('onboarding retention dashboard:', err?.message || err)
    return sendJson(res, 500, { error: err.message || 'Could not load onboarding retention' })
  }
}
