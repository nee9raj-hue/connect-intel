import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { aggregateCompaniesFromEntries, companySlugId } from './companiesHub.js'

describe('aggregateCompaniesFromEntries', () => {
  it('groups leads by company name', () => {
    const rows = aggregateCompaniesFromEntries([
      {
        lead: { id: 'l1', company: 'Acme Corp', city: 'Mumbai' },
        crm: { status: 'new', deals: [{ amount: 1000 }] },
        assignedToUserId: 'u1',
      },
      {
        lead: { id: 'l2', company: 'Acme Corp' },
        crm: { status: 'replied', leadScore: 80 },
      },
      {
        lead: { id: 'l3', company: 'Beta LLC' },
        crm: { status: 'new' },
      },
    ])

    assert.equal(rows.length, 2)
    const acme = rows.find((r) => r.name === 'Acme Corp')
    assert.equal(acme.leadCount, 2)
    assert.equal(acme.openDeals, 1)
    assert.equal(acme.topScore, 80)
    assert.equal(acme.id, companySlugId('acme corp'))
  })

  it('merges companies that share the same domain', () => {
    const rows = aggregateCompaniesFromEntries([
      {
        lead: { id: 'l1', company: 'Alvar Fresh', companyDomain: 'alvarfresh.com' },
        crm: { status: 'new' },
      },
      {
        lead: { id: 'l2', company: 'Alvar Fresh Pvt Ltd', companyDomain: 'alvarfresh.com' },
        crm: { status: 'replied' },
      },
    ])

    assert.equal(rows.length, 1)
    assert.equal(rows[0].leadCount, 2)
    assert.equal(rows[0].domain, 'alvarfresh.com')
  })
})
