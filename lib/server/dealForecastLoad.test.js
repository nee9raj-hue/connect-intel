import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDealsForecastReply,
  isDealsForecastQuestion,
} from './dealForecastLoad.js'

describe('dealForecastLoad', () => {
  it('detects deal forecast questions', () => {
    assert.equal(isDealsForecastQuestion('What is our revenue forecast?'), true)
    assert.equal(isDealsForecastQuestion('How many leads in pipeline?'), false)
  })

  it('formats forecast summary for copilot', () => {
    const text = formatDealsForecastReply({
      dealCount: 3,
      openCount: 2,
      openValue: 300_000,
      weightedPipeline: 140_000,
      forecast30d: 58_000,
      forecast90d: 115_000,
      wonValue: 80_000,
      winRate: 50,
      atRiskValue: 20_000,
    })
    assert.match(text, /Weighted forecast/)
    assert.match(text, /Stale/)
  })
})
