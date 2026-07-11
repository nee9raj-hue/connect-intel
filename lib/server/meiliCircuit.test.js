import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getMeiliCircuitStatus,
  isMeiliCircuitOpen,
  recordMeiliCircuitFailure,
  recordMeiliCircuitSuccess,
} from './meilisearch/circuit.js'

describe('meili circuit breaker', () => {
  it('opens after consecutive failures', () => {
    recordMeiliCircuitSuccess()
    assert.equal(isMeiliCircuitOpen(), false)
    recordMeiliCircuitFailure(new Error('timeout'))
    assert.equal(isMeiliCircuitOpen(), false)
    recordMeiliCircuitFailure(new Error('timeout'))
    assert.equal(isMeiliCircuitOpen(), true)
    const status = getMeiliCircuitStatus()
    assert.equal(status.open, true)
    assert.ok(status.lastError.includes('timeout'))
    recordMeiliCircuitSuccess()
    assert.equal(isMeiliCircuitOpen(), false)
  })
})
