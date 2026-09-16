import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyAssigneeTeamOnPipelineEntry,
  ensureOrgTeamLeadTags,
  flattenHierarchyTeams,
  memberUserIdsForTeams,
  teamForUser,
} from './orgTeamLeadTags.js'

describe('orgTeamLeadTags', () => {
  const teams = [
    {
      id: 'team-ocean',
      name: 'Ocean',
      departmentId: 'dept-sales',
      members: [{ userId: 'rep-1' }],
    },
    {
      id: 'team-b2c',
      name: 'B2C Rajasthan',
      departmentId: 'dept-sales',
      members: [{ userId: 'rep-2' }],
    },
  ]

  it('flattens hierarchy teams', () => {
    const flat = flattenHierarchyTeams({
      departments: [{ name: 'Sales', teams }],
    })
    assert.equal(flat.length, 2)
    assert.equal(flat[0].departmentName, 'Sales')
  })

  it('creates team-name tags and applies them on assign', () => {
    const store = { organizations: [{ id: 'org1', leadTags: [] }] }
    ensureOrgTeamLeadTags(store, 'org1', teams, 'admin')
    const tags = store.organizations[0].leadTags
    assert.equal(tags.length, 2)
    assert.ok(tags.some((t) => t.name === 'Ocean' && t.teamId === 'team-ocean'))

    const entry = { assignedToUserId: null }
    const crm = applyAssigneeTeamOnPipelineEntry(store, 'org1', entry, { tagIds: [] }, 'rep-1', teams)
    assert.equal(entry.teamId, 'team-ocean')
    assert.equal(entry.departmentId, 'dept-sales')
    const oceanTag = tags.find((t) => t.teamId === 'team-ocean')
    assert.ok(crm.tagIds.includes(oceanTag.id))

    const next = applyAssigneeTeamOnPipelineEntry(store, 'org1', entry, crm, 'rep-2', teams)
    const b2cTag = store.organizations[0].leadTags.find((t) => t.teamId === 'team-b2c')
    assert.equal(entry.teamId, 'team-b2c')
    assert.ok(next.tagIds.includes(b2cTag.id))
    assert.equal(next.tagIds.includes(oceanTag.id), false)
  })

  it('resolves members for selected teams', () => {
    assert.equal(teamForUser(teams, 'rep-2')?.id, 'team-b2c')
    assert.deepEqual(memberUserIdsForTeams(teams, ['team-ocean']), ['rep-1'])
  })
})
