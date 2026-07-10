import { createId } from './store.js'
import { DEFAULT_DEAL_EXPORT_COLUMNS } from './dealExport.js'
import { DEFAULT_PIPELINE_EXPORT_COLUMNS } from './pipelineExport.js'

const REPORT_MODULES = new Set(['pipeline', 'deals'])

function defaultColumnsForModule(module) {
  return module === 'deals' ? DEFAULT_DEAL_EXPORT_COLUMNS : DEFAULT_PIPELINE_EXPORT_COLUMNS
}

function reportScope(report) {
  return report?.scope === 'org' ? 'org' : 'personal'
}

function sameOrg(report, user) {
  return (report.organizationId || null) === (user.organizationId || null)
}

function canManageOrgReports(user) {
  return Boolean(user?.organizationId && user?.isOrgAdmin)
}

export function listReportDefinitions(store, user, { module = null } = {}) {
  store.reportDefinitions = store.reportDefinitions || []
  const moduleFilter = module ? String(module).trim() : null
  return store.reportDefinitions
    .filter((r) => {
      if (!REPORT_MODULES.has(r.module)) return false
      if (moduleFilter && r.module !== moduleFilter) return false
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

export function getReportDefinition(store, user, reportId, { module = null } = {}) {
  const reports = listReportDefinitions(store, user, { module })
  return reports.find((r) => r.id === reportId) || null
}

export function sanitizeReportSchedule(schedule, user) {
  if (!schedule || typeof schedule !== 'object' || !schedule.enabled) {
    return { enabled: false }
  }

  const cadence = schedule.cadence === 'weekly' ? 'weekly' : 'daily'
  const weekday =
    cadence === 'weekly'
      ? Math.min(6, Math.max(0, Number.isFinite(Number(schedule.weekday)) ? Number(schedule.weekday) : 1))
      : null
  const recipientEmails = Array.isArray(schedule.recipientEmails)
    ? schedule.recipientEmails
        .map((email) => String(email || '').trim().toLowerCase())
        .filter((email) => email.includes('@'))
        .slice(0, 5)
    : []

  if (!recipientEmails.length && user?.email?.includes('@')) {
    recipientEmails.push(String(user.email).trim().toLowerCase())
  }
  if (!recipientEmails.length) {
    throw new Error('Add at least one recipient email for scheduled delivery')
  }

  return {
    enabled: true,
    cadence,
    weekday,
    recipientEmails,
  }
}

export function updateReportSchedule(store, user, reportId, scheduleInput) {
  store.reportDefinitions = store.reportDefinitions || []
  const idx = store.reportDefinitions.findIndex((row) => row.id === reportId)
  if (idx < 0) throw new Error('Report not found')

  const report = store.reportDefinitions[idx]
  if (!sameOrg(report, user)) throw new Error('Report not found')

  if (reportScope(report) === 'org') {
    if (!canManageOrgReports(user)) throw new Error('Report not found')
  } else if (report.userId !== user.id) {
    throw new Error('Report not found')
  }

  const schedule = sanitizeReportSchedule(scheduleInput, user)
  report.schedule = schedule
  if (!schedule.enabled) {
    delete report.lastScheduledRunKey
    delete report.lastScheduledRunAt
  }
  report.updatedAt = new Date().toISOString()
  return report
}

export function saveReportDefinition(
  store,
  user,
  {
    name,
    module = 'pipeline',
    serverFilters,
    advancedFilters,
    columns,
    scope = 'personal',
    schedule: scheduleInput,
  }
) {
  const reportModule = REPORT_MODULES.has(module) ? module : 'pipeline'
  const label = String(name || '').trim().slice(0, 80)
  if (!label) throw new Error('Report name required')

  const normalizedScope = scope === 'org' ? 'org' : 'personal'
  if (normalizedScope === 'org') {
    if (!user.organizationId) throw new Error('Org-shared reports require a company workspace')
    if (!canManageOrgReports(user)) {
      throw new Error('Only company admins can create org-shared reports')
    }
  }

  const schedule = scheduleInput ? sanitizeReportSchedule(scheduleInput, user) : { enabled: false }

  const report = {
    id: createId('rpt'),
    module: reportModule,
    userId: user.id,
    organizationId: user.organizationId || null,
    scope: normalizedScope,
    name: label,
    serverFilters:
      reportModule === 'deals'
        ? sanitizeDealServerFilters(serverFilters)
        : sanitizeServerFilters(serverFilters),
    advancedFilters: sanitizeAdvancedFilters(advancedFilters),
    columns: sanitizeColumns(columns, reportModule),
    schedule,
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

function sanitizeDealServerFilters(filters) {
  const f = filters && typeof filters === 'object' ? filters : {}
  return {
    dealStage: String(f.dealStage || 'all').slice(0, 40),
    q: String(f.q || f.search || '').slice(0, 120),
    assigneeUserId: f.assigneeUserId ? String(f.assigneeUserId).slice(0, 80) : null,
    leadId: f.leadId ? String(f.leadId).slice(0, 80) : null,
    transportMode: String(f.transportMode || 'all').slice(0, 24),
    dateFrom: f.dateFrom ? String(f.dateFrom).slice(0, 12) : null,
    dateTo: f.dateTo ? String(f.dateTo).slice(0, 12) : null,
  }
}

function sanitizeColumns(columns, module = 'pipeline') {
  const allowed = new Set(defaultColumnsForModule(module))
  const list = Array.isArray(columns) ? columns.map((c) => String(c).trim()).filter((c) => allowed.has(c)) : []
  return list.length ? list : [...defaultColumnsForModule(module)]
}
