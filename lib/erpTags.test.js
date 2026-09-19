import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeErpTags, readErpTagsFromLead, stampErpTagsOnEntry } from './erpTags.js'
import { buildCrmPayload } from './leadLastOrder.js'

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

test('readErpTagsFromLead prefers crm_payload.erp_tags and ignores CRM tagIds', () => {
  const lead = {
    crm: { tagIds: ['crm-tag-1'] },
    crm_payload: {
      lastOrderCreatedAt: '2026-09-01T00:00:00.000Z',
      erp_tags: [{ name: 'Active', color: '#25D366', type: 'automatic' }],
    },
    erp: { erpTags: [{ name: 'Ignored', color: '#000000', type: 'manual' }] },
  }
  assert.deepEqual(readErpTagsFromLead(lead), [
    { name: 'Active', color: '#25d366', type: 'automatic' },
  ])
})

test('readErpTagsFromLead falls back to erp.erpTags', () => {
  assert.deepEqual(
    readErpTagsFromLead({
      erp: { erpTags: [{ name: 'Early', color: '#112233', type: 'automatic' }] },
    }),
    [{ name: 'Early', color: '#112233', type: 'automatic' }]
  )
})

test('readErpTagsFromLead treats an empty erp_tags array as none', () => {
  assert.deepEqual(
    readErpTagsFromLead({
      crm_payload: { erp_tags: [], lastOrderCreatedAt: '2026-09-01T00:00:00.000Z' },
      erp: { erpTags: [{ name: 'Stale', color: '#000000', type: 'manual' }] },
    }),
    []
  )
})

test('stampErpTagsOnEntry writes crm_payload without touching tagIds', () => {
  const entry = {
    crm: { tagIds: ['keep-me'], status: 'new' },
    crm_payload: { lastOrderCreatedAt: '2026-01-01T00:00:00.000Z' },
    erp: { revenue: { xindusId: '99' } },
  }
  stampErpTagsOnEntry(entry, [{ name: 'Churn', color: '#ff0000', type: 'automatic' }])
  assert.deepEqual(entry.crm.tagIds, ['keep-me'])
  assert.deepEqual(entry.crm_payload.erp_tags, [{ name: 'Churn', color: '#ff0000', type: 'automatic' }])
  assert.deepEqual(entry.erp.erpTags, [{ name: 'Churn', color: '#ff0000', type: 'automatic' }])
})

test('buildCrmPayload preserves erp_tags separately from tagIds', () => {
  const payload = buildCrmPayload({
    crm: { tagIds: ['crm-1'], status: 'new' },
    crm_payload: {
      erp_tags: [{ name: 'Active', color: '#25D366', type: 'automatic' }],
    },
  })
  assert.deepEqual(payload.tagIds, ['crm-1'])
  assert.deepEqual(payload.erp_tags, [{ name: 'Active', color: '#25d366', type: 'automatic' }])
})
