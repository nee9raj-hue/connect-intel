import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cookieDomainFromRequest } from './cookies.js'

describe('session cookie host', () => {
  it('keeps connectintel.net cookies shared across subdomains', () => {
    assert.equal(
      cookieDomainFromRequest({ headers: { host: 'connectintel.net' } }),
      '.connectintel.net'
    )
  })

  it('uses a host-only cookie on crm.xindus.net so login sticks', () => {
    assert.equal(
      cookieDomainFromRequest({ headers: { host: 'crm.xindus.net' } }),
      null
    )
  })

  it('reads the public host from x-forwarded-host', () => {
    assert.equal(
      cookieDomainFromRequest({
        headers: { 'x-forwarded-host': 'crm.xindus.net', host: 'localhost' },
      }),
      null
    )
  })
})
