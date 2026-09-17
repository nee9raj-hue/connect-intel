import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildUniqueCustomersReport, matchUniqueCustomerFilters } from './uniqueCustomersDashboard.js'

const TZ = 'Asia/Kolkata'

function entry({ company, owner, lastOrder, revenue = 0, status = 'active_trading', tagIds = [] }) {
  return {
    owner_id: owner,
    lead_status: status,
    entry: {
      assignedToUserId: owner,
      lead: { id: `lead_${company}`, company },
      crm: { status, tagIds, lastOrderCreatedAt: lastOrder },
      erp: { revenue: { revenue } },
    },
  }
}

describe('uniqueCustomersDashboard', () => {
  it('counts unique companies once per last-order week', () => {
    const rows = [
      entry({ company: 'Zenith Drinks', owner: 'u1', lastOrder: '2026-09-03T00:00:00.000Z', revenue: 5000 }),
      entry({ company: 'ZENITH DRINKS PRIVATE LIMITED', owner: 'u1', lastOrder: '2026-09-03T00:00:00.000Z', revenue: 5000 }),
      entry({ company: 'Acme', owner: 'u2', lastOrder: '2026-09-16T00:00:00.000Z', revenue: 1200 }),
    ]
    const report = buildUniqueCustomersReport(rows, { year: 2026, month: 9, timeZone: TZ, ownerNames: { u1: 'Manoj', u2: 'Priya' } })
    assert.equal(report.totals.uniqueCustomers, 2)
    assert.equal(report.totals.revenue, 6200)
    assert.ok(report.weeks.length >= 4)
    const withCustomers = report.weeks.filter((w) => w.uniqueCustomers > 0)
    assert.equal(withCustomers.reduce((n, w) => n + w.uniqueCustomers, 0), 2)
    assert.equal(report.groups.length, 2)
    assert.equal(report.groups.find((g) => g.ownerName === 'Manoj').uniqueCustomers, 1)
  })

  it('filters by tag and owner', () => {
    const row = entry({ company: 'Acme', owner: 'u1', lastOrder: '2026-09-03T00:00:00.000Z', tagIds: ['t1'] })
    assert.equal(matchUniqueCustomerFilters(row.entry, row, { tagIds: ['t1'] }), true)
    assert.equal(matchUniqueCustomerFilters(row.entry, row, { tagIds: ['t2'] }), false)
    assert.equal(matchUniqueCustomerFilters(row.entry, row, { ownerIds: ['u2'] }), false)
  })
})
