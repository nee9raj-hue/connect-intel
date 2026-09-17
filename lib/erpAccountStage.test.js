import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyErpAccountStage, hasErpTraded, suggestCrmStatusFromErp } from './erpAccountStage.js'

const NOW = Date.parse('2026-09-17T00:00:00.000Z')

describe('erpAccountStage', () => {
  it('marks recent ERP onboarded accounts with no trade as new_account', () => {
    const entry = {
      crm: { status: 'unqualified' },
      erp: { revenue: { customerCreatedAt: '2026-08-01', shipmentCount: 0 } },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), 'new_account')
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'new_account')
  })

  it('does not mark accounts that have traded', () => {
    const entry = {
      crm: { status: 'unqualified' },
      erp: {
        revenue: {
          customerCreatedAt: '2026-08-01',
          lastShipmentDate: '2026-08-20',
          shipmentCount: 1,
        },
      },
    }
    assert.equal(hasErpTraded(entry), true)
    assert.equal(suggestCrmStatusFromErp(entry, NOW), null)
  })

  it('does not demote active traders', () => {
    const entry = {
      crm: { status: 'active_trading' },
      erp: { revenue: { customerCreatedAt: '2026-08-01' } },
    }
    applyErpAccountStage(entry, NOW)
    assert.equal(entry.crm.status, 'active_trading')
  })

  it('ignores old created dates', () => {
    const entry = {
      crm: { status: 'unqualified' },
      erp: { revenue: { customerCreatedAt: '2024-01-01' } },
    }
    assert.equal(suggestCrmStatusFromErp(entry, NOW), null)
  })
})
