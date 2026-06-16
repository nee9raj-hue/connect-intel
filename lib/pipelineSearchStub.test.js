import assert from 'node:assert/strict'
import test from 'node:test'
import { meiliDocToEntryStub } from './server/meilisearch/pipelineSearchStub.js'
import { repPipelineEntryVisible } from './pipelineOwner.js'

test('meiliDocToEntryStub preserves savedBy for visibility when assignee is null', () => {
  const stub = meiliDocToEntryStub({
    organizationId: 'org1',
    leadId: 'lead-1',
    assignedToUserId: null,
    savedByUserId: 'neeraj',
    ownerUserId: 'neeraj',
  })
  assert.equal(repPipelineEntryVisible(stub, 'pakhi'), false)
  assert.equal(repPipelineEntryVisible(stub, 'neeraj'), true)
})

test('meiliDocToEntryStub legacy combined assignee field maps to owner', () => {
  const stub = meiliDocToEntryStub({
    organizationId: 'org1',
    leadId: 'lead-2',
    assignedToUserId: 'neeraj',
  })
  assert.equal(repPipelineEntryVisible(stub, 'pakhi'), false)
})
