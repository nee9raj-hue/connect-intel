import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('extensionLeadMatch', () => {
  it('exports matchPipelineLeadsByEmails', async () => {
    const mod = await import('./extensionLeadMatch.js')
    assert.equal(typeof mod.matchPipelineLeadsByEmails, 'function')
  })
})
