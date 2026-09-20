import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeLeadForClientLight } from './crm.js'

test('mergeLeadForClientLight includes recent activities for workspace patches', () => {
  const entry = {
    savedAt: '2026-01-01T00:00:00.000Z',
    userId: 'u1',
    lead: { id: 'l1', company: 'Acme' },
    crm: {
      status: 'contacted',
      activities: [
        { id: 'a1', type: 'call', summary: 'Call — connected', createdAt: '2026-01-02T00:00:00.000Z' },
      ],
      tasks: [],
      meetings: [],
      deals: [{ id: 'd1', name: 'Deal 1', stage: 'new' }],
    },
  }
  const lead = mergeLeadForClientLight(entry)
  assert.equal(lead.listLight, true)
  assert.equal(lead.crm.activities.length, 1)
  assert.equal(lead.crm.activities[0].type, 'call')
  assert.equal(lead.crm.deals.length, 1)
})

test('pipeline list last shipment comes from ERP lastShipmentDate when crm lastOrder is empty', async () => {
  const { mergeLeadForClientListMinimal } = await import('./crm.js')
  const lead = mergeLeadForClientListMinimal({
    lead: { id: 'l2', company: 'XLP ENGINEERS PVT LTD' },
    crm: { status: 'active_trading', tagIds: ['crm-1'] },
    crm_payload: {
      lastOrderCreatedAt: null,
      erp_tags: [{ name: 'Active', color: '#25D366', type: 'automatic' }],
    },
    erp: { revenue: { lastShipmentDate: '2026-07-11', shipmentCount: 10 } },
  })
  assert.ok(String(lead.crm.lastOrderCreatedAt || '').startsWith('2026-07-11'))
  assert.deepEqual(lead.crm.tagIds, ['crm-1'])
  assert.deepEqual(lead.erpTags, [{ name: 'Active', color: '#25d366', type: 'automatic' }])
})

test('mergeLeadForClientListMinimal exposes ERP stage as a display tag', async () => {
  const { mergeLeadForClientListMinimal } = await import('./crm.js')
  const lead = mergeLeadForClientListMinimal({
    lead: { id: 'l5', company: 'New ERP Account' },
    crm: { status: 'new_account', tagIds: ['crm-1'] },
  })
  assert.deepEqual(lead.crm.tagIds, ['crm-1'])
  assert.equal(lead.erpTags[0].name, 'Early')
  assert.equal(lead.erpTags[0].source, 'stage')
})

test('mergeLeadForClientListMinimal reads revenue.tags tagName as erpTags', async () => {
  const { mergeLeadForClientListMinimal } = await import('./crm.js')
  const lead = mergeLeadForClientListMinimal({
    lead: { id: 'l4', company: 'Acme Freight' },
    crm: { status: 'active_trading', tagIds: [] },
    erp: {
      revenue: {
        tags: [{ tagName: 'Active', color: '#25D366', type: 'automatic' }],
      },
    },
  })
  assert.deepEqual(lead.crm.tagIds, [])
  assert.deepEqual(lead.erpTags, [{ name: 'Active', color: '#25d366', type: 'automatic' }])
})
