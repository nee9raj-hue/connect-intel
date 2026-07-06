import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { recordPipelineAudit } from './auditPipeline.js'

describe('recordPipelineAudit', () => {
  it('no-ops without action or resourceId', () => {
    assert.doesNotThrow(() => recordPipelineAudit({}))
    assert.doesNotThrow(() => recordPipelineAudit({ action: 'pipeline.lead_updated' }))
  })
})
