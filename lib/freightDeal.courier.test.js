import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  courierContractProjection,
  syncCourierLanes,
  emptyCourierProfile,
} from './freightDeal.js'
import { dealMatchesCustomerType } from './crmPipelineFlow.js'
import { filterPipelineDealRows } from './pipelineDealsFilter.js'

describe('courier contract projection', () => {
  it('sums country lanes into monthly revenue and a term-length contract', () => {
    const courier = syncCourierLanes(emptyCourierProfile(), ['usa', 'uk'])
    courier.contractTerm = '6'
    courier.lanes = [
      { countryId: 'usa', monthlyShipments: 100, monthlyWeightKg: 800, targetRatePerKg: 400 },
      { countryId: 'uk', monthlyShipments: 40, monthlyWeightKg: 200, targetRatePerKg: 450 },
    ]
    courier.competitorRatePerKg = 450
    courier.proposedRatePerKg = 420
    courier.costRatePerKg = 300
    const projection = courierContractProjection(courier)
    assert.equal(projection.monthlyShipments, 140)
    assert.equal(projection.monthlyWeightKg, 1000)
    assert.equal(projection.monthlyRevenue, 800 * 400 + 200 * 450)
    assert.equal(projection.contractValue, projection.monthlyRevenue * 6)
    assert.equal(projection.annualRunRate, projection.monthlyRevenue * 12)
    assert.ok(projection.priceGapPct > 0)
    assert.ok(projection.marginPct > 0)
  })

  it('keeps lane numbers when a country is hidden and selected again', () => {
    const first = syncCourierLanes(emptyCourierProfile(), ['usa'])
    first.lanes[0].monthlyWeightKg = 50
    const hidden = syncCourierLanes(first, [])
    const back = syncCourierLanes(hidden, ['usa'])
    assert.equal(courierContractProjection(hidden).monthlyWeightKg, null)
    assert.equal(back.lanes.find((lane) => lane.countryId === 'usa').monthlyWeightKg, 50)
  })

  it('splits commercial and courier deals', () => {
    const rows = [
      { deal: { id: 'a', stage: 'rfq', freight: { customerType: 'spot_rfq' }, updatedAt: '2026-09-01' } },
      { deal: { id: 'b', stage: 'quoted', freight: { customerType: 'courier' }, updatedAt: '2026-09-01' } },
    ]
    assert.equal(filterPipelineDealRows(rows, { book: 'commercial' }).length, 1)
    assert.equal(filterPipelineDealRows(rows, { book: 'courier' })[0].deal.id, 'b')
    assert.equal(dealMatchesCustomerType({ customerType: 'spot_rfq' }, 'commercial'), true)
  })
})
