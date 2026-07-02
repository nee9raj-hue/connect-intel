import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  finalizeApiPipelineRequest,
  isObservabilityApiRoute,
  recordPipelineRead,
  runWithApiPipelineContext,
} from './apiPipelineContext.js'

describe('isObservabilityApiRoute', () => {
  it('matches crm and marketing routes', () => {
    assert.equal(isObservabilityApiRoute('crm/team-metrics'), true)
    assert.equal(isObservabilityApiRoute('marketing/campaigns'), true)
    assert.equal(isObservabilityApiRoute('health'), false)
  })
})

describe('recordPipelineRead', () => {
  it('tracks max rows and source inside request context', () => {
    runWithApiPipelineContext('crm/deals', () => {
      recordPipelineRead({ rows: 10, source: 'shard_full' })
      recordPipelineRead({ rows: 5, source: 'ignored' })
      recordPipelineRead({ rows: 42, source: 'pipeline_leads_table' })

      const result = finalizeApiPipelineRequest({
        route: 'crm/deals',
        durationMs: 120,
        statusCode: 200,
      })

      assert.equal(result.pipelineRowsRead, 42)
      assert.equal(result.pipelineSource, 'pipeline_leads_table')
      assert.equal(result.logged, true)
    })
  })

  it('skips logging for non-observability routes with zero pipeline reads', () => {
    const result = finalizeApiPipelineRequest({
      route: 'health',
      durationMs: 5,
      statusCode: 200,
    })
    assert.equal(result.logged, false)
    assert.equal(result.pipelineRowsRead, 0)
  })
})
