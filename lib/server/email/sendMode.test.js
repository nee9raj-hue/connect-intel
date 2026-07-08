import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EMAIL_SEND_MODE, resolveEmailSendMode } from './sendMode.js'

describe('resolveEmailSendMode', () => {
  it('queues all sends when background email is enabled', () => {
    assert.equal(resolveEmailSendMode(1, { backgroundEmail: true }), EMAIL_SEND_MODE.QUEUED)
    assert.equal(resolveEmailSendMode(25, { backgroundEmail: true }), EMAIL_SEND_MODE.QUEUED)
  })

  it('uses inline for small batches when background email is off', () => {
    assert.equal(resolveEmailSendMode(5, { backgroundEmail: false }), EMAIL_SEND_MODE.INLINE)
    assert.equal(resolveEmailSendMode(26, { backgroundEmail: false }), EMAIL_SEND_MODE.QUEUED)
  })

  it('returns inline for zero recipients', () => {
    assert.equal(resolveEmailSendMode(0, { backgroundEmail: true }), EMAIL_SEND_MODE.INLINE)
  })
})
