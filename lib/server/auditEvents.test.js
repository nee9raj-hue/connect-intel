import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isAuditEventsEnabled } from './auditEvents.js'

describe('isAuditEventsEnabled', () => {
  it('returns boolean', () => {
    assert.equal(typeof isAuditEventsEnabled(), 'boolean')
  })
})
