import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeLeadForClientLight } from './crm.js'
import { addMeeting } from './crmWorkflow.js'

test('mergeLeadForClientLight keeps call summary and meeting notes', () => {
  const entry = {
    savedAt: '2026-01-01T00:00:00.000Z',
    userId: 'u1',
    lead: { id: 'l1', company: 'Acme' },
    crm: {
      status: 'contacted',
      lastCommunicationType: 'meeting',
      lastCommunicationSummary: 'Meeting scheduled: Intro · Sep 23 · Discuss rates',
      activities: [],
      tasks: [],
      meetings: [
        {
          id: 'm1',
          title: 'Intro',
          scheduledAt: '2026-09-23T10:00:00.000Z',
          type: 'call',
          notes: 'Discuss rates',
          location: 'Zoom',
        },
      ],
      deals: [],
    },
  }
  const lead = mergeLeadForClientLight(entry)
  assert.equal(lead.crm.meetings[0].notes, 'Discuss rates')
  assert.equal(lead.crm.meetings[0].location, 'Zoom')
  assert.equal(lead.crm.lastCommunicationSummary, 'Meeting scheduled: Intro · Sep 23 · Discuss rates')
})

test('scheduled meeting activity includes the notes', () => {
  const result = addMeeting(
    { status: 'contacted' },
    {
      title: 'Intro',
      scheduledAt: '2026-09-23T10:00:00.000Z',
      notes: 'Discuss rates',
      assignedToUserId: 'rep1',
    },
    { userId: 'rep1', name: 'Rep' }
  )
  assert.match(result.crm.activities[0].summary, /Discuss rates/)
  assert.equal(result.crm.activities[0].meta.notes, 'Discuss rates')
  assert.equal(result.meeting.notes, 'Discuss rates')
})

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

test('pipeline list includes last-30-day deals as slim clips', async () => {
  const { mergeLeadForClientListMinimal } = await import('./crm.js')
  const lead = mergeLeadForClientListMinimal({
    lead: { id: 'l3', company: 'Acme' },
    crm: {
      status: 'fresh',
      deals: [
        {
          id: 'recent',
          name: '21-09-2026 Acme 001',
          createdAt: new Date().toISOString(),
          stage: 'quoted',
          amount: 10,
          freight: { pickupCity: 'Mumbai', deliveryCity: 'Dubai', boxes: [{ id: 'b1' }] },
        },
        {
          id: 'old',
          name: 'Old',
          createdAt: '2024-01-01T00:00:00.000Z',
          stage: 'won',
        },
      ],
    },
  })
  assert.equal(lead.crm.deals.length, 1)
  assert.equal(lead.crm.deals[0].id, 'recent')
  assert.equal(lead.crm.deals[0].freight?.pickupCity, 'Mumbai')
  assert.equal(lead.crm.deals[0].freight?.boxes, undefined)
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
