import test from 'node:test'
import assert from 'node:assert/strict'
import { pickLatestCrmActivityAt, enrichIntelMembersLastActive } from './memberLastCrmActivity.js'
import { lastCrmActivityAtByActorsFromEntries } from './crmTouchpoints.js'

test('pickLatestCrmActivityAt chooses newest timestamp', () => {
  assert.equal(
    pickLatestCrmActivityAt('2026-06-18T12:00:00.000Z', '2026-06-24T14:00:00.000Z'),
    '2026-06-24T14:00:00.000Z'
  )
})

test('lastCrmActivityAtByActorsFromEntries finds actor on any lead assignee', () => {
  const recent = '2026-06-24T14:00:00.000Z'
  const map = lastCrmActivityAtByActorsFromEntries(
    [
      {
        assignedToUserId: 'other-rep',
        crm: {
          activities: [{ createdAt: recent, createdByUserId: 'pakhi', type: 'call' }],
        },
      },
    ],
    ['pakhi']
  )
  assert.equal(map.get('pakhi'), recent)
})

test('enrichIntelMembersLastActive uses entry scan when SQL unavailable', async () => {
  const recent = '2026-06-24T14:00:00.000Z'
  const members = await enrichIntelMembersLastActive(
    [
      {
        userId: 'pakhi',
        activitiesTotal: 15,
        lastActiveAt: '2026-06-18T12:00:00.000Z',
      },
    ],
    {
      orgId: null,
      entries: [
        {
          assignedToUserId: 'other',
          crm: {
            activities: [{ createdAt: recent, createdByUserId: 'pakhi', type: 'call' }],
          },
        },
      ],
    }
  )
  assert.equal(members[0].lastActiveAt, recent)
})
