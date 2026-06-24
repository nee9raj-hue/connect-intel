import test from 'node:test'
import assert from 'node:assert/strict'
import { enrichIntelMembersLastActive } from './memberLastCrmActivity.js'

test('enrichIntelMembersLastActive prefers entry scan over stale pulse fields on member', async () => {
  const members = await enrichIntelMembersLastActive(
    [
      {
        userId: 'dakash',
        name: 'Dakash',
        activitiesTotal: 0,
        lastActiveAt: '2026-06-24T14:00:00.000Z',
        lastInAppAt: '2026-06-24T14:00:00.000Z',
      },
    ],
    {
      orgId: null,
      entries: [
        {
          userId: 'dakash',
          crm: {
            activities: [
              { createdAt: '2026-06-10T08:00:00.000Z', createdByUserId: 'dakash', type: 'note' },
            ],
          },
        },
      ],
    }
  )

  assert.equal(members[0].lastActiveAt, '2026-06-10T08:00:00.000Z')
  assert.equal(members[0].lastInAppAt, '2026-06-24T14:00:00.000Z')
})

test('enrichIntelMembersLastActive clears misleading pulse-only last active', async () => {
  const members = await enrichIntelMembersLastActive(
    [
      {
        userId: 'dakash',
        activitiesTotal: 0,
        lastActiveAt: '2026-06-24T14:00:00.000Z',
      },
    ],
    { orgId: null, entries: [] }
  )

  assert.equal(members[0].lastActiveAt, null)
})
