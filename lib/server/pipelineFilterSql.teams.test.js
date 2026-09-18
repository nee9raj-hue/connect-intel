import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendPipelineFilterSqlParts,
  filtersUseTeamSql,
  pipelineTeamOwnerSqlPart,
} from './pipelineFilterSql.js'
import { filterPipelineEntries } from './pipelineQuery.js'

test('team SQL uses owner_id of team members, not pipeline team_id', () => {
  const part = pipelineTeamOwnerSqlPart({
    teamIds: ['team-sales'],
    teamMemberUserIds: ['user_lokesh', 'user_tanishq'],
  })
  assert.equal(part, 'owner_id=in.(user_lokesh,user_tanishq)')
  assert.equal(filtersUseTeamSql({ teamIds: ['team-sales'] }), true)
})

test('team SQL falls back to team_id when the team has no members', () => {
  assert.equal(pipelineTeamOwnerSqlPart({ teamIds: ['team-sales'] }), 'team_id=eq.team-sales')
})

test('appendPipelineTeamSqlParts does not collide with tag or= filters', () => {
  const parts = appendPipelineFilterSqlParts([], {
    tagIds: ['t1', 't2'],
    teamIds: ['team-sales'],
    teamMemberUserIds: ['user_lokesh'],
  })
  assert.equal(parts.filter((p) => p.startsWith('or=')).length, 1)
  assert.ok(parts.some((p) => p === 'owner_id=eq.user_lokesh'))
})

test('filterPipelineEntries team chip matches owner when lead.teamId is stale', () => {
  const leads = [
    { id: 'a', teamId: 'old-erp-team', assignedToUserId: 'user_lokesh', crm: {} },
    { id: 'b', teamId: 'team-sales', assignedToUserId: 'user_vivek', crm: {} },
    { id: 'c', teamId: null, assignedToUserId: 'user_lokesh', crm: {} },
  ]
  const out = filterPipelineEntries(leads, {
    teamIds: ['team-sales'],
    teamMemberUserIds: ['user_lokesh'],
  })
  assert.deepEqual(
    out.map((l) => l.id).sort(),
    ['a', 'c']
  )
})
