import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  allowedTagIdsForMember,
  allowedTeamIdsForMember,
  consumeTeamScopedLeadTags,
  isOrgWideLeadTag,
  memberCanUseLeadTag,
  mergeTeamScopedTagFilters,
  repFilterLiftsOwnerScope,
  teamIdsFromHierarchyForUser,
} from './pipelineMemberVisibility.js'

describe('pipelineMemberVisibility', () => {
  const ocean = { id: 'tag-ocean', name: 'Ocean', teamId: 'team-ocean', source: 'org_team' }
  const adminTag = { id: 'tag-vip', name: 'VIP', teamId: null, source: 'admin' }
  const b2b = { id: 'tag-b2b', name: 'Non Large B2B', teamId: 'team-b2b', source: 'org_team' }

  it('treats admin tags as org-wide and team tags as team-scoped', () => {
    assert.equal(isOrgWideLeadTag(adminTag), true)
    assert.equal(isOrgWideLeadTag(ocean), false)
    assert.equal(memberCanUseLeadTag(ocean, ['team-ocean']), true)
    assert.equal(memberCanUseLeadTag(ocean, ['team-b2b']), false)
    assert.equal(memberCanUseLeadTag(adminTag, ['team-b2b']), true)
  })

  it('lets Navya filter Ocean-tagged leads only when she is on Ocean', () => {
    assert.deepEqual(
      allowedTagIdsForMember(['tag-ocean', 'tag-vip', 'tag-b2b'], [ocean, adminTag, b2b], ['team-ocean']),
      ['tag-ocean', 'tag-vip']
    )
    assert.deepEqual(allowedTeamIdsForMember(['team-ocean', 'team-b2b'], ['team-ocean']), ['team-ocean'])
  })

  it('turns a team tag in More filters into that team book for Dakash and Vivek', () => {
    const consumed = consumeTeamScopedLeadTags(['tag-b2b', 'tag-vip'], [ocean, adminTag, b2b], ['team-b2b'])
    assert.deepEqual(consumed.teamIds, ['team-b2b'])
    assert.deepEqual(consumed.tagIds, ['tag-vip'])
    const merged = mergeTeamScopedTagFilters(
      { tagIds: ['tag-b2b'], teamIds: [] },
      [ocean, adminTag, b2b],
      ['team-b2b']
    )
    assert.deepEqual(merged.teamIds, ['team-b2b'])
    assert.deepEqual(merged.tagIds, [])
    assert.deepEqual(
      consumeTeamScopedLeadTags(['tag-ocean'], [ocean, adminTag, b2b], ['team-b2b']).tagIds,
      ['tag-ocean']
    )
  })

  it('lifts assigned-only scope when a team or tag filter is applied', () => {
    assert.equal(repFilterLiftsOwnerScope({}), false)
    assert.equal(repFilterLiftsOwnerScope({ teamIds: ['team-b2b'] }), true)
    assert.equal(repFilterLiftsOwnerScope({ tagIds: ['tag-ocean'] }), true)
  })

  it('reads Dakash and Vivek team ids from hierarchy members', () => {
    const departments = [
      {
        name: 'Sales',
        teams: [
          {
            id: 'team-b2b',
            name: 'Non Large B2B',
            members: [{ userId: 'dakash' }, { userId: 'vivek' }],
          },
        ],
      },
    ]
    assert.deepEqual(teamIdsFromHierarchyForUser(departments, 'dakash'), ['team-b2b'])
    assert.deepEqual(teamIdsFromHierarchyForUser(departments, 'navya', 'team-ocean'), ['team-ocean'])
  })
})
