import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { signSessionToken, verifySessionToken } from './sessionJwt.js'

describe('sessionJwt', () => {
  it('round-trips user claims including organizationId', () => {
    const user = {
      id: 'u1',
      email: 'rep@example.com',
      name: 'Rep',
      organizationId: 'org1',
      accountType: 'company',
      orgRole: 'member',
    }
    const token = signSessionToken(user)
    const payload = verifySessionToken(token)
    assert.equal(payload.userId, 'u1')
    assert.equal(payload.organizationId, 'org1')
    assert.equal(payload.accountType, 'company')
  })

  it('rejects tampered tokens', () => {
    const token = signSessionToken({ id: 'u1', email: 'a@b.com', name: 'A' })
    const bad = `${token}x`
    assert.equal(verifySessionToken(bad), null)
  })
})
