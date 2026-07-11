import test from 'node:test'
import assert from 'node:assert/strict'
import { companySlugFromName, companyTargetFromLead } from './accountNavigation.js'

test('companySlugFromName normalizes pipeline company names', () => {
  assert.equal(companySlugFromName('Acme Corp.'), 'acme_corp_')
  assert.equal(companySlugFromName(''), null)
})

test('companyTargetFromLead prefers companyId when present', () => {
  assert.deepEqual(companyTargetFromLead({ company: 'Xindus', companyId: 'co_123' }), {
    companyId: 'co_123',
    companyName: 'Xindus',
  })
  assert.deepEqual(companyTargetFromLead({ company: 'Xindus Network' }), {
    companyId: 'xindus_network',
    companyName: 'Xindus Network',
  })
  assert.equal(companyTargetFromLead({ company: '' }), null)
})
