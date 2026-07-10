import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isScheduledReportDue, scheduledRunKey } from './reportScheduledExport.js'
import { sanitizeReportSchedule } from './reportDefinitions.js'

const user = {
  id: 'user-1',
  email: 'rep@acme.test',
  organizationId: 'org-1',
}

describe('scheduled report delivery helpers', () => {
  it('builds stable daily and weekly run keys', () => {
    const day = new Date('2026-07-10T09:00:00.000Z')
    assert.equal(scheduledRunKey('daily', day), 'day-2026-07-10')
    assert.match(scheduledRunKey('weekly', day), /^week-2026-W/)
  })

  it('marks daily reports due once per UTC day', () => {
    const now = new Date('2026-07-10T09:00:00.000Z')
    const report = {
      schedule: { enabled: true, cadence: 'daily', recipientEmails: ['rep@acme.test'] },
      lastScheduledRunKey: 'day-2026-07-09',
    }
    assert.equal(isScheduledReportDue(report, now), true)
    report.lastScheduledRunKey = scheduledRunKey('daily', now)
    assert.equal(isScheduledReportDue(report, now), false)
  })

  it('runs weekly reports only on the configured weekday', () => {
    const friday = new Date('2026-07-10T09:00:00.000Z') // Friday UTC
    const report = {
      schedule: {
        enabled: true,
        cadence: 'weekly',
        weekday: 5,
        recipientEmails: ['rep@acme.test'],
      },
    }
    assert.equal(isScheduledReportDue(report, friday), true)
    const thursday = new Date('2026-07-09T09:00:00.000Z')
    assert.equal(isScheduledReportDue(report, thursday), false)
  })

  it('defaults schedule recipients to the saving user', () => {
    const schedule = sanitizeReportSchedule({ enabled: true, cadence: 'daily' }, user)
    assert.deepEqual(schedule.recipientEmails, ['rep@acme.test'])
  })
})
