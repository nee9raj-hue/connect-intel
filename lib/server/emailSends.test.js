import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isEmailSendsEnabled, recordEmailSend } from './emailSends.js'

describe('emailSends', () => {
  it('isEmailSendsEnabled returns boolean', () => {
    assert.equal(typeof isEmailSendsEnabled(), 'boolean')
  })

  it('recordEmailSend no-ops without source', () => {
    assert.doesNotThrow(() => recordEmailSend({ organizationId: 'org-1' }))
  })
})
