import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildUniqueCustomersReport, matchUniqueCustomerFilters } from './uniqueCustomersDashboard.js'
import { buildOwnerMemberIndex } from '../erpOwner.js'

const TZ = 'Asia/Kolkata'

function entry({ company, owner, lastOrder, revenue = 0, status = 'active_trading', tagIds = [], ownerEmail }) {
  return {
    owner_id: owner,
    lead_status: status,
    entry: {
      assignedToUserId: owner,
      lead: { id: `lead_${company}`, company },
      crm: { status, tagIds, lastOrderCreatedAt: lastOrder },
      erp: {
        revenue: { revenue },
        ownership: ownerEmail
          ? { salesOwner: { name: owner, email: ownerEmail } }
          : {},
      },
    },
  }
}

describe('uniqueCustomersDashboard', () => {
  it('counts unique companies once per last-order week', () => {
    const rows = [
      entry({
        company: 'Zenith Drinks',
        owner: 'u1',
        ownerEmail: 'manoj@x.test',
        lastOrder: '2026-09-03T00:00:00.000Z',
        revenue: 5000,
      }),
      entry({
        company: 'ZENITH DRINKS PRIVATE LIMITED',
        owner: 'u1',
        ownerEmail: 'manoj@x.test',
        lastOrder: '2026-09-03T00:00:00.000Z',
        revenue: 5000,
      }),
      entry({
        company: 'Acme',
        owner: 'u2',
        ownerEmail: 'priya@x.test',
        lastOrder: '2026-09-16T00:00:00.000Z',
        revenue: 1200,
      }),
    ]
    const ownerIndex = buildOwnerMemberIndex(
      {
        users: [
          { id: 'u1', email: 'manoj@x.test', name: 'Manoj' },
          { id: 'u2', email: 'priya@x.test', name: 'Priya' },
        ],
        organizationMemberships: [
          { userId: 'u1', organizationId: 'org', status: 'active' },
          { userId: 'u2', organizationId: 'org', status: 'active' },
        ],
      },
      'org'
    )
    const report = buildUniqueCustomersReport(rows, {
      year: 2026,
      month: 9,
      timeZone: TZ,
      ownerNames: { u1: 'Manoj', u2: 'Priya', unassigned: 'Unassigned' },
      ownerIndex,
    })
    assert.equal(report.totals.uniqueCustomers, 2)
    assert.equal(report.totals.revenue, 6200)
    assert.ok(report.weeks.length >= 4)
    const withCustomers = report.weeks.filter((w) => w.uniqueCustomers > 0)
    assert.equal(withCustomers.reduce((n, w) => n + w.uniqueCustomers, 0), 2)
    assert.equal(report.groups.length, 2)
    assert.equal(report.groups.find((g) => g.ownerName === 'Manoj').uniqueCustomers, 1)
  })

  it('filters by tag and owner', () => {
    const row = entry({
      company: 'Acme',
      owner: 'u1',
      ownerEmail: 'manoj@x.test',
      lastOrder: '2026-09-03T00:00:00.000Z',
      tagIds: ['t1'],
    })
    const ownerIndex = buildOwnerMemberIndex(
      {
        users: [{ id: 'u1', email: 'manoj@x.test', name: 'Manoj' }],
        organizationMemberships: [{ userId: 'u1', organizationId: 'org', status: 'active' }],
      },
      'org'
    )
    assert.equal(matchUniqueCustomerFilters(row.entry, row, { tagIds: ['t1'] }, ownerIndex), true)
    assert.equal(matchUniqueCustomerFilters(row.entry, row, { tagIds: ['t2'] }, ownerIndex), false)
    assert.equal(matchUniqueCustomerFilters(row.entry, row, { ownerIds: ['u2'] }, ownerIndex), false)
  })

  it('does not treat importer assignee as the sales owner', () => {
    const row = entry({
      company: 'Acme',
      owner: 'neeraj',
      lastOrder: '2026-09-03T00:00:00.000Z',
    })
    const report = buildUniqueCustomersReport([row], {
      year: 2026,
      month: 9,
      timeZone: TZ,
      ownerNames: { neeraj: 'Neeraj', unassigned: 'Unassigned' },
    })
    assert.equal(report.groups[0].ownerName, 'Unassigned')
  })

  it('counts customers whose last shipment lives only on ERP revenue', () => {
    const row = {
      lead_id: 'lead_erp',
      entry: {
        lead: { id: 'lead_erp', company: 'Ocean Traders' },
        crm: { status: 'active_trading' },
        erp: { revenue: { lastShipmentDate: '2026-07-22', revenue: 9000 } },
      },
    }
    const report = buildUniqueCustomersReport([row], {
      year: 2026,
      month: 0,
      timeZone: TZ,
      ownerNames: { unassigned: 'Unassigned' },
    })
    assert.equal(report.totals.uniqueCustomers, 1)
    assert.equal(report.totals.revenue, 9000)
  })
})
