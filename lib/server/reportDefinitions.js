import { createId } from './store.js'
import { DEFAULT_PIPELINE_EXPORT_COLUMNS } from './pipelineExport.js'

function reportScope(report) {
  return report?.scope === 'org' ? 'org' : 'personal'
}

function sameOrg(report, user) {
  return (report.organizationId || null) === (user.organizationId || null)
}

function canManageOrgReports(user) {
  return Boolean(user?.organizationId && user?.isOrgAdmin)
}

export function listReportDefinitions(store, user) {
  store.reportDefinitions = store.reportDefinitions || []
  return store.reportDefinitions
    .filter((r) => {
      if (r.module !== 'pipeline') return false
      if (!sameOrg(r, user)) return false
      if (reportScope(r) === 'org') return true
      return r.userId === user.id
    })
    .map((r) => ({
      ...r,
      scope: reportScope(r),
      shared: reportScope(r) === 'org',
      canDelete: reportScope(r) === 'org' ? canManageOrgReports(user) : r.userId === user.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getReportDefinition(store, user, reportId) {
  const reports = listReportDefinitions(store, user)
  return reports.find((r) => r.id === reportId) || null
}

export function saveReportDefinition(store, user, { name, serverFilters, advancedFilters, columns, scope = 'personal' }) {
  const label = String(name || '').trim().slice(0, 80)
  if (!label) throw new Error('Report name required')

  const normalizedScope = scope === 'org' ? 'org' : 'personal'
  if (normalizedScope === 'org') {
    if (!user.organizationId) throw new Error('Org-shared reports require a company workspace')
    if (!canManageOrgReports(user)) {
      throw new Error('Only company admins can create org-shared reports')
    }
  }

  const report = {
    id: createId('rpt'),
    module: 'pipeline',
    userId: user.id,
    organizationId: user.organizationId || null,
    scope: normalizedScope,
    name: label,
    serverFilters: sanitizeServerFilters(serverFilters),
    advancedFilters: sanitizeAdvancedFilters(advancedFilters),
    columns: sanitizeColumns(columns),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  store.reportDefinitions = store.reportDefinitions || []
  store.reportDefinitions.push(report)
  return report
}

export function deleteReportDefinition(store, user, reportId) {
  store.reportDefinitions = store.reportDefinitions || []
  const idx = store.reportDefinitions.findIndex((r) => r.id === reportId)
  if (idx < 0) throw new Error('Report not found')

  const report = store.reportDefinitions[idx]
  if (!sameOrg(report, user)) throw new Error('Report not found')

  if (reportScope(report) === 'org') {
    if (!canManageOrgReports(user)) throw new Error('Report not found')
  } else if (report.userId !== user.id) {
    throw new Error('Report not found')
  }

  store.reportDefinitions.splice(idx, 1)
  return { ok: true }
}

function sanitizeServerFilters(filters) {
  const f = filters && typeof filters === 'object' ? filters : {}
  const cities = Array.isArray(f.cities)
    ? f.cities.map((c) => String(c).trim().slice(0, 80)).filter(Boolean).slice(0, 30)
    : []
  const states = Array.isArray(f.states)
    ? f.states.map((s) => String(s).trim().slice(0, 80)).filter(Boolean).slice(0, 30)
    : []
  const tagIds = Array.isArray(f.tagIds)
    ? f.tagIds.map((t) => String(t).trim()).filter(Boolean).slice(0, 40)
    : []
  return {
    status: String(f.status || 'all').slice(0, 40),
    q: String(f.q || f.search || '').slice(0, 120),
    cities,
    states,
    assigneeUserId: f.assigneeUserId ? String(f.assigneeUserId).slice(0, 80) : null,
    teamId: f.teamId ? String(f.teamId).slice(0, 80) : null,
    tagIds,
    tagMode: String(f.tagMode || 'any').slice(0, 12),
    minLeadScore: f.minLeadScore != null && f.minLeadScore !== '' ? Number(f.minLeadScore) : null,
    maxLeadScore: f.maxLeadScore != null && f.maxLeadScore !== '' ? Number(f.maxLeadScore) : null,
    followUpDue: Boolean(f.followUpDue),
    overdueFollowUp: Boolean(f.overdueFollowUp),
    stuck: Boolean(f.stuck),
  }
}

function sanitizeAdvancedFilters(filters) {
  const f = filters && typeof filters === 'object' ? filters : {}
  return {
    contact: String(f.contact || 'any').slice(0, 24),
    tagMode: String(f.tagMode || 'any').slice(0, 12),
    smartTags: Array.isArray(f.smartTags)
      ? f.smartTags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
      : [],
  }
}

function sanitizeColumns(columns) {
  const allowed = new Set(DEFAULT_PIPELINE_EXPORT_COLUMNS)
  const list = Array.isArray(columns) ? columns.map((c) => String(c).trim()).filter((c) => allowed.has(c)) : []
  return list.length ? list : [...DEFAULT_PIPELINE_EXPORT_COLUMNS]
}
