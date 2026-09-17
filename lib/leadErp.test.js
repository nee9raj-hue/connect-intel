import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  erpFromImportRow,
  filterErpRevenuePeriods,
  getLeadErp,
  mergeLeadErp,
  normalizeLeadErp,
  sumErpPeriodMetrics,
} from './leadErp.js'

describe('leadErp', () => {
  it('normalizes empty overlay', () => {
    const erp = normalizeLeadErp(null)
    assert.equal(erp.revenue.revenue, null)
    assert.equal(erp.finance.invoiceStatus, null)
    assert.deepEqual(erp.finance.ledger, [])
  })

  it('maps flat import columns', () => {
    const erp = erpFromImportRow({
      revenue: '120000',
      shipment_count: '4',
      last_shipment_date: '2026-08-01',
      invoice_status: 'partial',
      pending_payments: '15000',
    })
    assert.equal(erp.revenue.revenue, 120000)
    assert.equal(erp.revenue.shipmentCount, 4)
    assert.equal(erp.finance.invoiceStatus, 'partial')
    assert.equal(erp.finance.pendingPayments, 15000)
  })

  it('filters and sums period rows', () => {
    const periods = [
      { year: 2026, month: 8, week: 32, revenue: 10, shipmentCount: 1 },
      { year: 2026, month: 9, week: 36, revenue: 20, shipmentCount: 2 },
    ]
    const filtered = filterErpRevenuePeriods(periods, { months: ['8'] })
    assert.equal(filtered.length, 1)
    assert.deepEqual(sumErpPeriodMetrics(filtered), { revenue: 10, shipmentCount: 1 })
  })

    it('merges incoming ERP without wiping empty fields', () => {
    const merged = mergeLeadErp(
      { revenue: { revenue: 50, lastShipmentDate: '2026-01-01' } },
      { finance: { invoiceStatus: 'open' }, ownership: { salesOwner: { email: 'a@x.test', name: 'A' } } }
    )
    assert.equal(merged.revenue.revenue, 50)
    assert.equal(merged.finance.invoiceStatus, 'open')
    assert.equal(merged.ownership.salesOwner.email, 'a@x.test')
  })

  it('builds ERP from a client lead trading profile', () => {
    const erp = getLeadErp({
      company: 'ZENITH DRINKS PRIVATE LIMITED',
      tradingProfile: { shipmentCount: 9, lastShipmentAt: '2026-07-12T00:00:00.000Z' },
      crm: { deals: [] },
    })
    assert.equal(erp.revenue.shipmentCount, 9)
    assert.equal(erp.revenue.lastShipmentDate, '2026-07-12')
  })
})
