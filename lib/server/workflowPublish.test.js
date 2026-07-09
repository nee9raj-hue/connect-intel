import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { workflowDefinitionHash } from './workflowPublish.js'
import { crmVisualWorkflowToDefinition } from './workflowRuleBridge.js'

describe('workflowPublish', () => {
  it('hashes definitions deterministically', () => {
    const def = crmVisualWorkflowToDefinition({
      id: 'vwf-1',
      name: 'Follow up',
      trigger: 'status_enter',
      graph: { nodes: [{ id: 'n1', type: 'action' }], edges: [] },
    })
    const a = workflowDefinitionHash(def)
    const b = workflowDefinitionHash(def)
    assert.equal(a, b)
    assert.equal(a.length, 24)
  })
})
