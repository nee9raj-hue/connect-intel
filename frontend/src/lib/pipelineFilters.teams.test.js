import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPipelineFilters } from './pipelineFilters.js'

test('pipeline team filter matches sales owner like tags, even if lead.teamId differs', () => {
  const leads = [
    { id: 'chuninda', teamId: null, assignedToUserId: 'user_lokesh', crm: {} },
    { id: 'other', teamId: 'team-sales', assignedToUserId: 'user_vivek', crm: {} },
  ]
  const out = applyPipelineFilters(leads, {
    teamIds: ['team-sales'],
    teamMemberUserIds: ['user_lokesh'],
  })
  assert.deepEqual(out.map((l) => l.id), ['chuninda'])
})
