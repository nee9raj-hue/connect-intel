import test from 'node:test'
import assert from 'node:assert/strict'
import { computeRepLeadStats } from './repSummary.js'

test('computeRepLeadStats counts open and follow-up for one rep', () => {
  const entries = [
    {
      userId: 'rep-a',
      crm: { status: 'new', activities: [] },
    },
    {
      assignedToUserId: 'rep-a',
      crm: { status: 'follow_up', activities: [{ createdAt: new Date().toISOString() }] },
    },
    {
      userId: 'rep-b',
      crm: { status: 'new', activities: [] },
    },
  ]
  const stats = computeRepLeadStats(entries, 'rep-a')
  assert.equal(stats.open, 2)
  assert.equal(stats.followups, 1)
  assert.equal(stats.userId, 'rep-a')
})
