import assert from 'node:assert/strict'
import {
  getCachedSessionUser,
  markSessionDatabaseRefreshed,
  setCachedSessionUser,
  shouldRefreshSessionFromDatabase,
} from '../lib/server/authSessionCache.js'

const user = { id: 'u1', email: 'a@test.com' }
setCachedSessionUser('u1', user)
assert.deepEqual(getCachedSessionUser('u1'), user)
assert.equal(shouldRefreshSessionFromDatabase('u1'), true)
markSessionDatabaseRefreshed('u1', user)
assert.equal(shouldRefreshSessionFromDatabase('u1'), false)

console.log('test-auth-session-cache: ok')
