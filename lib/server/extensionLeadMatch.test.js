import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExtensionSearchQuery,
  subjectSearchHints,
} from './extensionLeadMatch.js'

describe('extensionLeadMatch', () => {
  it('exports matchPipelineLeadsForExtension', async () => {
    const mod = await import('./extensionLeadMatch.js')
    assert.equal(typeof mod.matchPipelineLeadsForExtension, 'function')
    assert.equal(typeof mod.matchPipelineLeadsByEmails, 'function')
  })

  it('subjectSearchHints extracts company from "for X with" subjects', () => {
    const hint = subjectSearchHints(
      'Export Shipping Solutions for Satvic Foods with Xindus Shipping Services'
    )
    assert.equal(hint, 'Satvic Foods')
  })

  it('buildExtensionSearchQuery combines subject and recipient names', () => {
    const q = buildExtensionSearchQuery({
      subject: 'Follow up for Acme Corp with our team',
      recipientNames: ['Viraj'],
    })
    assert.match(q, /Acme Corp/)
    assert.match(q, /Viraj/)
  })
})
