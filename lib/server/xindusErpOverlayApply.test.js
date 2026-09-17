import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pipelineLastOrderPeriodOr, pipelineOnboardedPeriodOr } from './pipelineDashboardPeriod.js'
import { indexOverlays, matchLeadToOverlay } from './xindusErpOverlayApply.js'
import { xindusIdFromLeadEntry } from '../xindusCustomerErp.js'

describe('pipelineDashboardPeriod', () => {
  it('filters ERP date-only shipment columns with YYYY-MM-DD bounds', () => {
    const filter = pipelineLastOrderPeriodOr('2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')
    assert.match(filter, /lastShipmentDate\.gte\.2026-01-01/)
    assert.match(filter, /lastShipmentDate\.lt\.2027-01-01/)
    assert.match(filter, /lastOrderCreatedAt\.gte\.2026-01-01T00%3A00%3A00\.000Z/)
  })

  it('filters onboarding dates with date-only bounds', () => {
    const filter = pipelineOnboardedPeriodOr('2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
    assert.match(filter, /firstShipmentAt\.gte\.2026-09-01/)
    assert.match(filter, /firstShipmentAt\.lt\.2026-10-01/)
    assert.doesNotMatch(filter, /2026-10-01T/)
  })
})

describe('xindusErpOverlayApply match', () => {
  it('matches company names that share a prefix after legal-suffix strip', () => {
    const index = indexOverlays([
      {
        company: 'Shree Enterprises Private Limited',
        xindusId: '4411',
        erp: { revenue: { lastShipmentDate: '2026-07-22', shipmentCount: 3 } },
      },
    ])
    const hit = matchLeadToOverlay(
      { lead: { company: 'Shree Enterprises JPR' } },
      index
    )
    assert.equal(hit?.xindusId, '4411')
  })

  it('matches a short brand like XLP to a longer ERP legal name', () => {
    const index = indexOverlays([
      {
        company: 'XLP Logistics Private Limited',
        xindusId: '8801',
        erp: { revenue: { lastShipmentDate: '2026-08-20', shipmentCount: 11 } },
      },
    ])
    const hit = matchLeadToOverlay({ lead: { company: 'XLP' } }, index)
    assert.equal(hit?.xindusId, '8801')
  })

  it('matches a numeric Xindus id stored on erp.revenue', () => {
    assert.equal(
      xindusIdFromLeadEntry({ erp: { revenue: { xindusId: '4411' } } }),
      '4411'
    )
    const index = indexOverlays([
      { xindusId: '4411', company: 'Other', erp: { revenue: { lastShipmentDate: '2026-07-01' } } },
    ])
    const hit = matchLeadToOverlay({ erp: { revenue: { xindusId: '4411' } }, lead: { company: 'Nope' } }, index)
    assert.equal(hit?.xindusId, '4411')
  })
})
