import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDealsForecast } from './dealPipeline.js'

describe('buildDealsForecast', () => {
  it('weights open freight deals by stage', () => {
    const forecast = buildDealsForecast(
      [
        { deal: { id: 'd1', stage: 'rfq', amount: 100_000, updatedAt: new Date().toISOString() } },
        { deal: { id: 'd2', stage: 'quoted', amount: 200_000, updatedAt: new Date().toISOString() } },
        { deal: { id: 'd3', stage: 'booked', amount: 50_000, updatedAt: new Date().toISOString() } },
        { deal: { id: 'd4', stage: 'won', amount: 80_000, updatedAt: new Date().toISOString() } },
      ],
      { freightOrg: true }
    )

    assert.equal(forecast.openCount, 3)
    assert.equal(forecast.openValue, 350_000)
    assert.equal(forecast.wonValue, 80_000)
    assert.ok(forecast.weightedPipeline > 0)
    assert.ok(forecast.weightedPipeline < forecast.openValue)
    assert.ok(forecast.forecast30d <= forecast.forecast90d)
    assert.equal(forecast.byStage.quoted.count, 1)
  })

  it('marks stale open deals as at-risk value', () => {
    const stale = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const forecast = buildDealsForecast(
      [{ deal: { id: 'd1', stage: 'negotiation', amount: 120_000, updatedAt: stale } }],
      { freightOrg: true }
    )
    assert.equal(forecast.atRiskValue, 120_000)
  })
})
