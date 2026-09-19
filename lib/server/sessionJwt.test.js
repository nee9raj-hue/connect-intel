import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'connect-intel-test-secret'

const { signSessionToken, verifySessionToken, payloadToUserRecord } = await import('./sessionJwt.js')

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

  it('rebuilds a Xindus workspace user from the JWT without the users blob', () => {
    const token = signSessionToken({
      id: 'u1',
      email: 'revenueb2b@xindus.net',
      name: 'Revenue',
      organizationId: 'org-xindus',
      accountType: 'company',
      orgRole: 'org_admin',
      isOrgAdmin: true,
      organizationName: 'Xindus',
      onboardingComplete: true,
      pipelineRole: 'org_admin',
    })
    const user = payloadToUserRecord(verifySessionToken(token))
    assert.equal(user.id, 'u1')
    assert.equal(user.organizationId, 'org-xindus')
    assert.equal(user.workspaceFeatures.freightDealRfq, true)
  })
})
