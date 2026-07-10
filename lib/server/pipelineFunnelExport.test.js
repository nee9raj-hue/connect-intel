import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { funnelSummaryToCsv } from './pipelineFunnelExport.js'

describe('pipelineFunnelExport', () => {
  it('builds funnel CSV with stage rows and total', () => {
    const csv = funnelSummaryToCsv({
      total: 12,
      byStatus: [
        { status: 'new', count: 5 },
        { status: 'contacted', count: 4 },
        { status: 'follow_up', count: 3 },
        { status: 'replied', count: 0 },
        { status: 'won', count: 0 },
        { status: 'active_trading', count: 0 },
        { status: 'lost', count: 0 },
      ],
      dealValues: {
        new: 1000,
        contacted: 2500,
        follow_up: 500,
        replied: 0,
        won: 0,
        active_trading: 0,
        lost: 0,
      },
    })
    const lines = csv.split('\n')
    assert.equal(lines[0], 'Stage,Label,Count,Deal value')
    assert.ok(lines.some((l) => l.includes('new') && l.includes('5')))
    assert.ok(lines.some((l) => l.includes('total') && l.includes('12')))
  })
})
