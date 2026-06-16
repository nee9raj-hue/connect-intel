import assert from 'node:assert/strict'
import test from 'node:test'
import { mergePipelineEntry, pickNewerAssignment } from './pipelineShard.js'

test('pickNewerAssignment keeps row with newer assignedAt', () => {
  const prev = {
    assignedToUserId: 'old-rep',
    assignedAt: '2026-01-01T00:00:00.000Z',
    assignedByUserId: 'mgr1',
  }
  const incoming = {
    assignedToUserId: 'new-rep',
    assignedAt: '2026-06-04T12:00:00.000Z',
    assignedByUserId: 'mgr2',
  }
  const picked = pickNewerAssignment(prev, incoming)
  assert.equal(picked.assignedToUserId, 'new-rep')
  assert.equal(picked.assignedByUserId, 'mgr2')
})

test('mergePipelineEntry preserves newer assignment when monolith CRM is fresher', () => {
  const tableRow = {
    lead: { id: 'lead-1' },
    assignedToUserId: 'new-rep',
    assignedAt: '2026-06-04T12:00:00.000Z',
    assignedByUserId: 'mgr2',
    pipelineUpdatedAt: '2026-06-04T12:00:00.000Z',
    crm: { status: 'new', activities: [{ id: 'a1', createdAt: '2026-01-01T00:00:00.000Z' }] },
  }
  const monolithRow = {
    lead: { id: 'lead-1' },
    assignedToUserId: 'old-rep',
    assignedAt: '2026-01-01T00:00:00.000Z',
    assignedByUserId: 'mgr1',
    pipelineUpdatedAt: '2026-06-04T13:00:00.000Z',
    crm: {
      status: 'contacted',
      activities: [
        { id: 'a1', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'a2', createdAt: '2026-06-04T13:00:00.000Z' },
      ],
    },
  }
  const merged = mergePipelineEntry(tableRow, monolithRow)
  assert.equal(merged.assignedToUserId, 'new-rep')
  assert.equal(merged.crm.status, 'contacted')
  assert.equal(merged.crm.activities.length, 2)
})
