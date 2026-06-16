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
