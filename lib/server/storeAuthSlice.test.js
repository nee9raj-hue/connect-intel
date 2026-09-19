import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AUTH_STORE_COLLECTIONS,
  LOGIN_STORE_COLLECTIONS,
  SESSION_STORE_COLLECTIONS,
} from './store.js'

describe('auth store slices', () => {
  it('session and login reads skip sessions and creditLedger blobs', () => {
    assert.deepEqual(SESSION_STORE_COLLECTIONS, [
      'users',
      'organizations',
      'organizationMemberships',
    ])
    assert.ok(!LOGIN_STORE_COLLECTIONS.includes('sessions'))
    assert.ok(!LOGIN_STORE_COLLECTIONS.includes('creditLedger'))
    assert.ok(AUTH_STORE_COLLECTIONS.includes('sessions'))
  })
})
