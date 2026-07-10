import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  deleteReportDefinition,
  listReportDefinitions,
  saveReportDefinition,
  updateReportSchedule,
} from './reportDefinitions.js'

const admin = {
  id: 'admin-1',
  organizationId: 'org-1',
  isOrgAdmin: true,
}

const rep = {
  id: 'rep-1',
  organizationId: 'org-1',
  isOrgAdmin: false,
}

function emptyStore() {
  return { reportDefinitions: [] }
}

describe('reportDefinitions org scope', () => {
  it('lists org-shared reports for all members in the org', () => {
    const store = {
      reportDefinitions: [
        {
          id: 'rpt_org',
          module: 'pipeline',
          userId: admin.id,
          organizationId: 'org-1',
          scope: 'org',
          name: 'Team pipeline',
          serverFilters: { status: 'hot' },
          columns: ['name', 'email'],
        },
        {
          id: 'rpt_personal',
          module: 'pipeline',
          userId: admin.id,
          organizationId: 'org-1',
          scope: 'personal',
          name: 'My export',
          serverFilters: { cities: ['Mumbai'] },
          columns: ['name', 'email'],
        },
      ],
    }

    const reports = listReportDefinitions(store, rep)
    assert.equal(reports.length, 1)
    assert.ok(reports.some((r) => r.id === 'rpt_org' && r.scope === 'org'))
  })

  it('saves org report when admin requests org scope', () => {
    const store = emptyStore()
    const report = saveReportDefinition(store, admin, {
      name: 'Weekly hot',
      scope: 'org',
      serverFilters: { status: 'hot', minLeadScore: 70 },
    })
    assert.equal(report.scope, 'org')
    assert.equal(report.module, 'pipeline')
    assert.equal(store.reportDefinitions.length, 1)
    assert.ok(report.columns.includes('name'))
  })

  it('rejects org scope for non-admin', () => {
    const store = emptyStore()
    assert.throws(
      () =>
        saveReportDefinition(store, rep, {
          name: 'Nope',
          scope: 'org',
          serverFilters: {},
        }),
      /Only company admins can create org-shared reports/
    )
  })

  it('saves deals module report with deal columns', () => {
    const store = emptyStore()
    const report = saveReportDefinition(store, admin, {
      name: 'Open RFQs',
      module: 'deals',
      scope: 'org',
      serverFilters: { dealStage: 'rfq', transportMode: 'air' },
    })
    assert.equal(report.module, 'deals')
    assert.ok(report.columns.includes('dealName'))
    assert.equal(report.serverFilters.dealStage, 'rfq')

    const pipelineOnly = listReportDefinitions(store, rep, { module: 'pipeline' })
    const dealsOnly = listReportDefinitions(store, rep, { module: 'deals' })
    assert.equal(pipelineOnly.length, 0)
    assert.equal(dealsOnly.length, 1)
  })

  it('saves report with optional email schedule', () => {
    const store = emptyStore()
    const report = saveReportDefinition(store, rep, {
      name: 'Morning hot',
      serverFilters: { status: 'hot' },
      schedule: { enabled: true, cadence: 'daily', recipientEmails: ['rep@example.com'] },
    })
    assert.equal(report.schedule.enabled, true)
    assert.equal(report.schedule.cadence, 'daily')
    assert.deepEqual(report.schedule.recipientEmails, ['rep@example.com'])
  })

  it('updates schedule on an existing report', () => {
    const store = emptyStore()
    const report = saveReportDefinition(store, rep, {
      name: 'Weekly export',
      serverFilters: {},
    })
    const updated = updateReportSchedule(store, rep, report.id, {
      enabled: true,
      cadence: 'weekly',
      weekday: 1,
      recipientEmails: ['rep@example.com'],
    })
    assert.equal(updated.schedule.cadence, 'weekly')
    assert.equal(updated.schedule.weekday, 1)
  })

  it('allows rep to delete own personal report only', () => {
    const store = {
      reportDefinitions: [
        {
          id: 'mine',
          module: 'pipeline',
          userId: rep.id,
          organizationId: 'org-1',
          scope: 'personal',
          name: 'Mine',
          serverFilters: {},
          columns: ['name'],
        },
        {
          id: 'theirs',
          module: 'pipeline',
          userId: admin.id,
          organizationId: 'org-1',
          scope: 'personal',
          name: 'Theirs',
          serverFilters: {},
          columns: ['name'],
        },
      ],
    }

    deleteReportDefinition(store, rep, 'mine')
    assert.equal(store.reportDefinitions.length, 1)
    assert.throws(() => deleteReportDefinition(store, rep, 'theirs'), /Report not found/)
  })
})
