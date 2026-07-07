import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCompanyDomain, inferLeadCompanyDomain } from './companyDomain.js'

describe('companyDomain', () => {
  it('normalizes website and email hosts', () => {
    assert.equal(normalizeCompanyDomain('https://www.AlvarFresh.com/about'), 'alvarfresh.com')
    assert.equal(normalizeCompanyDomain('sales@alvarfresh.com'), 'alvarfresh.com')
    assert.equal(normalizeCompanyDomain('gmail.com'), null)
  })

  it('infers domain from lead fields', () => {
    assert.equal(
      inferLeadCompanyDomain({ companyDomain: 'acme.io', email: 'a@gmail.com' }),
      'acme.io'
    )
    assert.equal(inferLeadCompanyDomain({ email: 'sales@beta.co' }), 'beta.co')
  })
})
