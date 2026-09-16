import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { funnelSummaryToCsv } from './pipelineFunnelExport.js'

describe('pipelineFunnelExport', () => {
  it('builds funnel CSV with stage rows and total', () => {
    const csv = funnelSummaryToCsv({
      total: 12,
      byStatus: [
        { status: 'unqualified', count: 5 },
        { status: 'qualified', count: 4 },
        { status: 'opportunity', count: 3 },
      ],
      dealValues: {
        unqualified: 1000,
        qualified: 2500,
        opportunity: 500,
      },
    })
    const lines = csv.split('\n')
    assert.equal(lines[0], 'Stage,Label,Count,Deal value')
    assert.ok(lines.some((l) => l.includes('unqualified') && l.includes('5')))
    assert.ok(lines.some((l) => l.includes('total') && l.includes('12')))
  })
})
