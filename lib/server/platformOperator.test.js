import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isPlatformOperatorUser } from './organizations.js'

describe('isPlatformOperatorUser', () => {
  it('treats invite@connectintel.net as platform operator', () => {
    assert.equal(
      isPlatformOperatorUser({ email: 'invite@connectintel.net', role: 'member' }),
      true
    )
  })

  it('treats ADMIN_EMAILS as platform operator', () => {
    const prev = process.env.ADMIN_EMAILS
    process.env.ADMIN_EMAILS = 'ops@example.com'
    assert.equal(isPlatformOperatorUser({ email: 'ops@example.com', role: 'member' }), true)
    if (prev === undefined) delete process.env.ADMIN_EMAILS
    else process.env.ADMIN_EMAILS = prev
  })
})
