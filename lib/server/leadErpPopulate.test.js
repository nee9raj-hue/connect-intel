import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildErpFromFacts } from '../leadErp.js'
import { buildWorkspaceShipmentIndex, matchWorkspaceShipments, populateLeadErp } from './leadErpPopulate.js'

describe('leadErpPopulate', () => {
  it('fills revenue periods and finance from shipments and deals', () => {
    const erp = buildErpFromFacts({
      shipments: [
        { date: '2026-08-04', amount: 10000, description: 'AE' },
        { date: '2026-08-20', amount: 5000, description: 'AN' },
      ],
      deals: [
        { name: 'Open RFQ', stage: 'quoted', value: 2000, updatedAt: '2026-09-01' },
        { name: 'Won lane', stage: 'won', value: 8000, closedAt: '2026-07-15' },
      ],
    })
    assert.equal(erp.revenue.revenue, 15000)
    assert.equal(erp.revenue.shipmentCount, 2)
    assert.equal(erp.revenue.lastShipmentDate, '2026-08-20')
    assert.ok(erp.revenue.periods.length >= 1)
    assert.equal(erp.finance.invoiceStatus, 'partial')
    assert.equal(erp.finance.pendingPayments, 2000)
    assert.equal(erp.finance.lastPaymentAmount, 8000)
    assert.ok(erp.finance.ledger.length >= 3)
  })

  it('matches workspace rows by company and customer code', () => {
    const index = buildWorkspaceShipmentIndex([
      {
        shipment_date: '2026-03-15',
        shipper: 'Calvin Handicrafts Pvt Ltd',
        final_amount: 118149.19,
        customer_code: 'CUST-1001',
      },
      {
        shipment_date: '2026-03-18',
        shipper: 'Other Co',
        final_amount: 10,
        customer_code: 'CUST-9',
      },
    ])
    const matched = matchWorkspaceShipments(index, {
      lead: { company: 'CALVIN HANDICRAFTS', customerCode: 'CUST-1001' },
    })
    assert.equal(matched.length, 1)
    assert.equal(matched[0].amount, 118149.19)
  })

  it('uses trading profile when workspace has no match', () => {
    const erp = populateLeadErp(
      { organizations: [{ id: 'org-1' }], orgWorkspaceImports: [] },
      { organizationId: 'org-1' },
      {
        tradingProfile: {
          shipmentCount: 4,
          lastShipmentAt: '2026-05-01T00:00:00.000Z',
          shipments: [{ date: '2026-04-01T00:00:00.000Z' }, { date: '2026-05-01T00:00:00.000Z' }],
        },
        crm: { deals: [] },
      }
    )
    assert.equal(erp.revenue.shipmentCount, 4)
    assert.equal(erp.revenue.lastShipmentDate, '2026-05-01')
    assert.equal(erp.revenue.revenue, null)
  })
})
