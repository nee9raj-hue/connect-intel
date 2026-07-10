import { buildOrgUserResponse } from './organizations.js'
import { assertOrgPermission } from './permissionEnforce.js'
import {
  DEFAULT_DEAL_EXPORT_COLUMNS,
  dealsToCsv,
  loadAllDealsForExport,
  resolveExportMaxRows as resolveDealExportMaxRows,
} from './dealExport.js'
import {
  DEFAULT_PIPELINE_EXPORT_COLUMNS,
  leadsToCsv,
  loadAllPipelineLeadsForExport,
  resolveExportMaxRows as resolvePipelineExportMaxRows,
} from './pipelineExport.js'
import { sendOrgNotificationEmail } from './email.js'
import { readStore, updateStorePartial } from './store.js'

function sanitizeFilename(name) {
  const base = String(name || 'report-export')
    .trim()
    .slice(0, 80)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'report-export'
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function scheduledRunKey(cadence, date = new Date()) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  if (cadence === 'weekly') return `week-${isoWeekKey(date)}`
  return `day-${y}-${m}-${d}`
}

export function isScheduledReportDue(report, now = new Date()) {
  const schedule = report?.schedule
  if (!schedule?.enabled) return false
  const cadence = schedule.cadence === 'weekly' ? 'weekly' : 'daily'
  if (cadence === 'weekly') {
    const weekday = Number.isFinite(Number(schedule.weekday)) ? Number(schedule.weekday) : 1
    if (now.getUTCDay() !== weekday) return false
  }
  const key = scheduledRunKey(cadence, now)
  return report.lastScheduledRunKey !== key
}

export async function buildReportCsvForReport(user, store, report) {
  const module = report.module === 'deals' ? 'deals' : 'pipeline'
  if (module === 'deals') {
    const maxRows = resolveDealExportMaxRows(user, store)
    const columns = report.columns?.length ? report.columns : DEFAULT_DEAL_EXPORT_COLUMNS
    const { deals, total, truncated } = await loadAllDealsForExport(
      user,
      store,
      report.serverFilters || {},
      { maxRows }
    )
    return {
      csv: dealsToCsv(deals, columns),
      filename: `${sanitizeFilename(report.name)}.csv`,
      rowCount: deals.length,
      truncated,
      total,
      maxRows,
      module,
    }
  }

  const maxRows = resolvePipelineExportMaxRows(user, store)
  const columns = report.columns?.length ? report.columns : DEFAULT_PIPELINE_EXPORT_COLUMNS
  const { leads, total, truncated } = await loadAllPipelineLeadsForExport(
    user,
    report.serverFilters || {},
    { maxRows }
  )
  return {
    csv: leadsToCsv(leads, columns),
    filename: `${sanitizeFilename(report.name)}.csv`,
    rowCount: leads.length,
    truncated,
    total,
    maxRows,
    module,
  }
}

async function deliverScheduledReport(store, report, now) {
  const dbUser = (store.users || []).find((row) => row.id === report.userId)
  if (!dbUser) return { ok: false, skipped: 'no_owner' }

  const user = buildOrgUserResponse(dbUser, store)
  try {
    await assertOrgPermission(user, 'export_leads', store)
  } catch {
    return { ok: false, skipped: 'no_export_permission' }
  }

  const built = await buildReportCsvForReport(user, store, report)
  if (built.truncated || built.total > built.maxRows) {
    return {
      ok: false,
      skipped: 'export_limit',
      total: built.total,
      maxRows: built.maxRows,
    }
  }

  const org = (store.organizations || []).find((row) => row.id === report.organizationId)
  const recipients = report.schedule?.recipientEmails || []
  const sentTo = []
  const failures = []

  for (const email of recipients) {
    const result = await sendOrgNotificationEmail({
      to: email,
      subject: `Scheduled report: ${report.name}`,
      html: `<p>Your scheduled <strong>${report.name}</strong> export is attached (${built.rowCount} row${built.rowCount === 1 ? '' : 's'}).</p>`,
      text: `Your scheduled ${report.name} export is attached (${built.rowCount} rows).`,
      organizationId: report.organizationId,
      organizationName: org?.name,
      attachments: [
        {
          filename: built.filename,
          content: Buffer.from(built.csv, 'utf8'),
          contentType: 'text/csv',
        },
      ],
    })
    if (result.sent) sentTo.push(email)
    else failures.push({ email, error: result.error || 'send_failed' })
  }

  if (sentTo.length) {
    const cadence = report.schedule?.cadence === 'weekly' ? 'weekly' : 'daily'
    await updateStorePartial(['reportDefinitions'], (draft) => {
      const row = (draft.reportDefinitions || []).find((item) => item.id === report.id)
      if (row) {
        row.lastScheduledRunKey = scheduledRunKey(cadence, now)
        row.lastScheduledRunAt = now.toISOString()
      }
      return draft
    })
  }

  return { ok: sentTo.length > 0, sentTo, failures, rowCount: built.rowCount }
}

export async function processScheduledReportExports({ limit = 25 } = {}) {
  const store = await readStore({
    only: ['reportDefinitions', 'users', 'organizations', 'organizationMemberships'],
  })
  const now = new Date()
  const due = (store.reportDefinitions || [])
    .filter((report) => isScheduledReportDue(report, now))
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 25)))

  const results = []
  for (const report of due) {
    try {
      const outcome = await deliverScheduledReport(store, report, now)
      results.push({ reportId: report.id, name: report.name, ...outcome })
    } catch (error) {
      results.push({
        reportId: report.id,
        name: report.name,
        ok: false,
        error: error.message || 'delivery_failed',
      })
    }
  }

  return {
    due: due.length,
    processed: results.length,
    sent: results.filter((row) => row.ok).length,
    results,
  }
}
