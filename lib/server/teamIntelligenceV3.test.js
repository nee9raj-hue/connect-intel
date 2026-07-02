import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildRevenueForecast } from './teamIntelligenceV3.js'

describe('buildRevenueForecast', () => {
  it('derives 30/90-day outlook from pipeline stages', () => {
    const forecast = buildRevenueForecast(
      {
        weightedPipelineValue: 1_000_000,
        wonValue: 120_000,
        totalLeads: 100,
        won: 8,
        staleLeads: 5,
      },
      {
        stages: [
          { id: 'proposal', volume: 10 },
          { id: 'negotiation', volume: 4 },
          { id: 'won', volume: 8 },
        ],
      }
    )

    assert.equal(forecast.weightedPipeline, 1_000_000)
    assert.equal(forecast.winRate, 8)
    assert.ok(forecast.forecast30d > 0)
    assert.ok(forecast.forecast90d >= forecast.forecast30d)
    assert.ok(forecast.atRiskValue > 0)
  })

  it('falls back when pipeline stages are empty', () => {
    const forecast = buildRevenueForecast({ weightedPipelineValue: 200_000, totalLeads: 20, won: 2 }, { stages: [] })
    assert.equal(forecast.forecast30d, 70_000)
    assert.equal(forecast.forecast90d, 110_000)
  })
})
