import assert from 'node:assert/strict'
import test from 'node:test'
import { pipelineRepVisibilityPostgrestFilter } from './server/pipelineQuery.js'
import { pipelineOwnerUserId, repPipelineEntryVisible } from './pipelineOwner.js'

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

test('pipelineRepVisibilityPostgrestFilter uses owner_id not assignee null pool', () => {
  const filter = pipelineRepVisibilityPostgrestFilter('pakhi-id')
  assert.match(filter, /owner_id\.eq\.pakhi-id/)
  assert.match(filter, /owner_id\.is\.null/)
  assert.doesNotMatch(filter, /assignedToUserId/)
})
