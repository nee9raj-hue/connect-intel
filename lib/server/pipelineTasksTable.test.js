import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPipelineTaskRow } from './pipelineTasksTable.js'
import { buildPipelineMeetingRow } from './pipelineMeetingsTable.js'

describe('buildPipelineTaskRow', () => {
  it('maps task fields for SQL upsert', () => {
    const row = buildPipelineTaskRow(
      'org-1',
      {
        lead: { id: 'lead-1', firstName: 'Neeraj', lastName: 'Kumar', company: 'Xindus' },
        assignedToUserId: 'user-9',
        crm: {},
      },
      {
        id: 'task-1',
        title: 'Call back',
        dueAt: '2026-06-24T10:00:00.000Z',
        assignedToUserId: 'user-9',
        createdAt: '2026-06-01T00:00:00.000Z',
      }
    )

    assert.equal(row.organization_id, 'org-1')
    assert.equal(row.lead_id, 'lead-1')
    assert.equal(row.task_id, 'task-1')
    assert.equal(row.status, 'open')
    assert.equal(row.owner_id, 'user-9')
    assert.equal(row.payload.leadName, 'Neeraj Kumar')
    assert.equal(row.payload.task.title, 'Call back')
  })

  it('marks completed tasks as done', () => {
    const row = buildPipelineTaskRow(
      'org-1',
      { lead: { id: 'lead-1' }, crm: {} },
      { id: 'task-2', title: 'Done task', completedAt: '2026-06-20T00:00:00.000Z' }
    )
    assert.equal(row.status, 'done')
  })
})

describe('buildPipelineMeetingRow', () => {
  it('maps meeting fields and ends_at', () => {
    const row = buildPipelineMeetingRow(
      'org-1',
      {
        lead: { id: 'lead-1', company: 'Xindus' },
        assignedToUserId: 'user-9',
        crm: {},
      },
      {
        id: 'mtg-1',
        title: 'Discovery call',
        scheduledAt: '2026-06-24T14:00:00.000Z',
        durationMinutes: 45,
        assignedToUserId: 'user-9',
      }
    )

    assert.equal(row.meeting_id, 'mtg-1')
    assert.equal(row.starts_at, '2026-06-24T14:00:00.000Z')
    assert.equal(row.ends_at, '2026-06-24T14:45:00.000Z')
    assert.equal(row.payload.company, 'Xindus')
  })
})
