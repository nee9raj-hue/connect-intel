import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeErpTags, readErpTagsFromLead } from './erpTags.js'

test('normalizeErpTags uses name/color/type and skips empty', () => {
  assert.deepEqual(normalizeErpTags([]), [])
  assert.deepEqual(
    normalizeErpTags([
      { name: 'Active', color: '#25D366', type: 'automatic' },
      { name: 'Dummy', color: '#B4876E', type: 'manual' },
      { name: '' },
    ]),
    [
      { name: 'Active', color: '#25d366', type: 'automatic' },
      { name: 'Dummy', color: '#b4876e', type: 'manual' },
    ]
  )
})

test('readErpTagsFromLead prefers live erp.erpTags over a stale crm_payload copy', () => {
  const lead = {
    crm: { tagIds: ['crm-tag-1'] },
    crm_payload: {
      lastOrderCreatedAt: '2026-09-01T00:00:00.000Z',
      erp_tags: [{ name: 'Stale', color: '#000000', type: 'manual' }],
    },
    erp: { erpTags: [{ name: 'Active', color: '#25D366', type: 'automatic' }] },
  }
  assert.deepEqual(readErpTagsFromLead(lead), [
    { name: 'Active', color: '#25d366', type: 'automatic' },
  ])
  assert.equal(lead.crm.tagIds[0], 'crm-tag-1')
})

test('readErpTagsFromLead falls back to crm_payload.erp_tags', () => {
  const lead = {
    crm: { tagIds: [] },
    crm_payload: { erp_tags: [{ name: 'Dummy', color: '#B4876E', type: 'manual' }] },
  }
  assert.deepEqual(readErpTagsFromLead(lead), [
    { name: 'Dummy', color: '#b4876e', type: 'manual' },
  ])
})
