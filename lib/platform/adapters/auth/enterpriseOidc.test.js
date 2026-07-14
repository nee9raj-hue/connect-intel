import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decodeJwtPayload, pickEmail } from './enterpriseOidc.js'

describe('enterprise OIDC profile parsing', () => {
  it('pickEmail prefers graph mail then id_token preferred_username', () => {
    assert.equal(
      pickEmail({ mail: 'User@Company.com' }, { preferred_username: 'other@tenant.com' }),
      'user@company.com'
    )
    assert.equal(pickEmail({}, { preferred_username: 'invite@connectintel.net' }), 'invite@connectintel.net')
    assert.equal(pickEmail({}, {}), '')
  })

  it('decodeJwtPayload reads preferred_username from id_token', () => {
    const payload = Buffer.from(
      JSON.stringify({ preferred_username: 'invite@connectintel.net', name: 'Invite' })
    ).toString('base64url')
    const token = `header.${payload}.sig`
    const claims = decodeJwtPayload(token)
    assert.equal(claims.preferred_username, 'invite@connectintel.net')
    assert.equal(pickEmail({}, {}, claims), 'invite@connectintel.net')
  })
})
