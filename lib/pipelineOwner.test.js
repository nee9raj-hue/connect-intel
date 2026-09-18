import assert from 'node:assert/strict'
import test from 'node:test'
import { pipelineRepVisibilityPostgrestFilter } from './server/pipelineQuery.js'
import { pipelineOwnerUserId, repPipelineEntryVisible } from './pipelineOwner.js'

test('ERP-imported leads do not use saved-by as the pipeline owner', () => {
  const entry = {
    assignedToUserId: null,
    savedByUserId: 'u-vivek',
    erp: { revenue: { xindusId: '5668', tags: [{ tagName: 'Churn' }] } },
    lead: { company: 'Chuninda' },
  }
  assert.equal(pipelineOwnerUserId(entry), null)
})

test('repPipelineEntryVisible hides another rep saved lead without assignee', () => {
  const entry = {
    assignedToUserId: null,
    savedByUserId: 'neeraj',
    userId: 'neeraj',
    lead: { id: 'lead-1' },
  }
  assert.equal(pipelineOwnerUserId(entry), 'neeraj')
  assert.equal(repPipelineEntryVisible(entry, 'pakhi'), false)
  assert.equal(repPipelineEntryVisible(entry, 'neeraj'), true)
})

test('repPipelineEntryVisible includes task participants and collaborators', () => {
  const entry = {
    assignedToUserId: 'neeraj',
    savedByUserId: 'neeraj',
    userId: 'neeraj',
    lead: { id: 'lead-2' },
    crm: {
      tasks: [
        {
          id: 't1',
          title: 'Follow up',
          assignedToUserId: 'dakash',
          participantUserIds: [],
        },
      ],
      meetings: [],
    },
  }
  assert.equal(repPipelineEntryVisible(entry, 'dakash'), true)
  assert.equal(repPipelineEntryVisible(entry, 'neeraj'), true)
  assert.equal(repPipelineEntryVisible(entry, 'other'), false)
})

test('pipelineRepVisibilityPostgrestFilter matches owner_id or JSON assignee', () => {
  const filter = pipelineRepVisibilityPostgrestFilter('pakhi-id')
  assert.match(filter, /owner_id\.eq\.pakhi-id/)
  assert.doesNotMatch(filter, /owner_id\.is\.null/)
  assert.match(filter, /assignedToUserId\.eq\.pakhi-id/)
})
