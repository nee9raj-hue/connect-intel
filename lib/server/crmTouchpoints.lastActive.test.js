import test from 'node:test'
import assert from 'node:assert/strict'
import { lastCrmActivityAtForUser } from './crmTouchpoints.js'

test('lastCrmActivityAtForUser ignores activity on owned leads by other reps', () => {
  const recent = '2026-06-24T12:00:00.000Z'
  const entries = [
    {
      assignedToUserId: 'dakash',
      crm: {
        activities: [
          { createdAt: recent, createdByUserId: 'lokesh', type: 'call' },
        ],
      },
    },
    {
      userId: 'dakash',
      crm: {
        activities: [
          { createdAt: '2026-06-10T08:00:00.000Z', createdByUserId: 'dakash', type: 'note' },
        ],
      },
    },
  ]

  assert.equal(lastCrmActivityAtForUser(entries, 'dakash'), '2026-06-10T08:00:00.000Z')
  assert.equal(lastCrmActivityAtForUser(entries, 'lokesh'), recent)
})
