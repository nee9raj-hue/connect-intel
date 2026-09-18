import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyErpAccountStage,
  hasErpTraded,
  isErpImportedLead,
  markCrmStatusManual,
  suggestCrmStatusFromErp,
} from './erpAccountStage.js'

const NOW = Date.parse('2026-09-17T00:00:00.000Z')

describe('erpAccountStage', () => {
  it('does not auto-stage ERP rows with no shipments into New Account or Qualified', () => {
    const entry = {
      crm: { status: 'unqualified' },
      erp: { revenue: { customerCreatedAt: '2024-01-01', shipmentCount: 0 } },
    }
    assert.equal(isErpImportedLead(entry), true)
    assert.equal(suggestCrmStatusFromErp(entry, NOW), null)
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'unqualified')
  })

  it('holds a first shipment as New Account for 60 days even if they keep shipping', () => {
    const entry = {
      crm: { status: 'unqualified' },
      erp: {
        revenue: {
          firstShipmentAt: '2026-08-20',
          lastShipmentDate: '2026-09-10',
          shipmentCount: 2,
        },
      },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'new_account')
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'new_account')
  })

  it('marks a regular trader with a shipment in the last 60 days as active_trading', () => {
    const entry = {
      crm: { status: 'new_account' },
      erp: {
        revenue: {
          firstShipmentAt: '2025-01-01',
          lastShipmentDate: '2026-08-20',
          shipmentCount: 12,
        },
      },
    }
    assert.equal(hasErpTraded(entry), true)
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'active_trading')
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'active_trading')
  })

  it('marks regular shippers idle 30–60 days as sales opportunity', () => {
    const entry = {
      crm: { status: 'active_trading' },
      erp: {
        revenue: {
          firstShipmentAt: '2025-01-01',
          lastShipmentDate: '2026-08-10',
          shipmentCount: 8,
        },
      },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'opportunity')
  })

  it('marks last shipment older than 60 days as churned', () => {
    const entry = {
      crm: { status: 'active_trading' },
      erp: {
        revenue: {
          firstShipmentAt: '2025-01-01',
          lastShipmentDate: '2026-06-01',
          shipmentCount: 4,
        },
      },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'churned')
  })

  it('marks no shipments in two years as lost', () => {
    const entry = {
      crm: { status: 'churned' },
      erp: { revenue: { lastShipmentDate: '2024-01-01', shipmentCount: 3 } },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'lost')
  })

  it('marks a negative balance older than one year as lost', () => {
    const entry = {
      crm: { status: 'active_trading' },
      erp: {
        revenue: { firstShipmentAt: '2024-01-01', lastShipmentDate: '2026-09-01', shipmentCount: 4 },
        finance: { pendingPayments: 12000, lastInvoiceDate: '2025-06-01', overdue: true },
      },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'lost')
  })

  it('does not overwrite a stage a rep set by hand', () => {
    const entry = {
      crm: markCrmStatusManual({ status: 'onboarding' }, { userId: 'rep1' }),
      erp: { revenue: { lastShipmentDate: '2026-08-20', shipmentCount: 2 } },
    }
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'onboarding')
  })

  it('does not classify leads that were not imported from ERP', () => {
    const entry = { crm: { status: 'qualified' }, lead: { company: 'Manual Co' } }
    assert.equal(isErpImportedLead(entry), false)
    assert.equal(suggestCrmStatusFromErp(entry, NOW), null)
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'qualified')
  })

  it('classifies XLP ENGINEERS last transacted 11 Jul 2026 as churned after 60 idle days', () => {
    const entry = {
      crm: { status: 'new_account' },
      lead: { company: 'XLP ENGINEERS PVT LTD' },
      erp: {
        revenue: {
          lastShipmentDate: '2026-07-11',
          lastTransactedDate: '2026-07-11',
          shipmentCount: 10,
        },
      },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'churned')
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'churned')
  })

  it('classifies regular ERP traders that only have lastOrderCreatedAt as active_trading', () => {
    const entry = {
      crm: { status: 'new_account', lastOrderCreatedAt: '2026-08-20T00:00:00.000Z' },
      lead: { company: 'XLP' },
      erp: { revenue: { shipmentCount: 9 } },
    }
    assert.equal(isErpImportedLead(entry), true)
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'active_trading')
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'active_trading')
  })

  it('uses ERP automatic Churn tag when the account never shipped', () => {
    const entry = {
      crm: { status: 'onboarding' },
      erp: {
        revenue: {
          xindusId: '5668',
          customerCreatedAt: '2026-02-26',
          tags: [{ tagName: 'Churn', type: 'automatic' }],
        },
      },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'churned')
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'churned')
  })

  it('moves stale New Account tags off when ERP has no shipment dates', () => {
    const entry = {
      crm: { status: 'new_account' },
      source: 'erp',
      erp: { revenue: { customerCreatedAt: '2024-08-16', shipmentCount: 0 } },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), null)
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'onboarding')
  })

  it('does not call shipment-count-only rows Active Trader when last shipment is missing', () => {
    const entry = {
      crm: { status: 'active_trading' },
      source: 'erp',
      erp: { revenue: { shipmentCount: 9 } },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), null)
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'onboarding')
  })
})
