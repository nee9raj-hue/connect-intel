import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExtensionSearchQuery,
  emailDomainSearchHints,
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

  it('subjectSearchHints ignores Gmail folder labels', () => {
    assert.equal(subjectSearchHints('Sent Mail'), '')
    assert.equal(subjectSearchHints('Inbox'), '')
  })

  it('emailDomainSearchHints splits alvarfresh into alvar fresh', () => {
    const hints = emailDomainSearchHints(['sales@alvarfresh.com'])
    assert.ok(hints.includes('alvarfresh'))
    assert.ok(hints.includes('alvar fresh'))
  })

  it('buildExtensionSearchQuery combines subject, names, and domain hints', () => {
    const q = buildExtensionSearchQuery({
      subject: 'Need USA rates for 500 Kg',
      recipientNames: ['Viraj'],
      emails: ['sales@alvarfresh.com'],
    })
    assert.match(q, /Need USA rates/)
    assert.match(q, /alvar fresh/i)
  })
})
