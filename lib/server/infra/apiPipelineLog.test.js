import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { logApiPipeline } from './apiPipelineLog.js'

describe('logApiPipeline', () => {
  let logs = []

  beforeEach(() => {
    logs = []
    console.log = (...args) => logs.push(args.join(' '))
  })

  afterEach(() => {
    delete console.log
  })

  it('emits structured api_pipeline JSON', () => {
    const payload = logApiPipeline({
      route: 'crm/team-metrics',
      durationMs: 88.4,
      pipelineRowsRead: 1200,
      pipelineSource: 'shard_full',
      statusCode: 200,
      loadCount: 1,
    })

    assert.equal(payload.event, 'api_pipeline')
    assert.equal(payload.route, 'crm/team-metrics')
    assert.equal(payload.durationMs, 88)
    assert.equal(payload.pipelineRowsRead, 1200)
    assert.equal(payload.pipelineSource, 'shard_full')
    assert.equal(payload.loadCount, 1)
    assert.equal(payload.statusCode, 200)

    const parsed = JSON.parse(logs[0])
    assert.equal(parsed.event, 'api_pipeline')
    assert.equal(parsed.pipelineRows, 1200)
  })
})
