import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPermanentSendError,
  isTransientSendError,
  shouldRetrySendError,
  nextRetryAtIso,
  MAX_MESSAGE_RETRY_ATTEMPTS,
} from './retry.js'

describe('messaging retry', () => {
  it('classifies permanent Gmail token errors', () => {
    assert.equal(isPermanentSendError('invalid_grant'), true)
    assert.equal(isTransientSendError('invalid_grant'), false)
  })

  it('classifies transient rate limits', () => {
    assert.equal(isTransientSendError('429 Too Many Requests'), true)
    assert.equal(isPermanentSendError('429 Too Many Requests'), false)
  })

  it('schedules retry for transient errors within attempt budget', () => {
    assert.equal(shouldRetrySendError('timeout', 0), true)
    assert.equal(shouldRetrySendError('timeout', MAX_MESSAGE_RETRY_ATTEMPTS), false)
    assert.equal(shouldRetrySendError('invalid_grant', 0), false)
  })

  it('nextRetryAtIso is in the future', () => {
    const at = Date.parse(nextRetryAtIso(0))
    assert.ok(at > Date.now())
  })
})
