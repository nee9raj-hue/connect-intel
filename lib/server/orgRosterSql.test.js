import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { membershipFromSqlProfile, teamMemberFromSqlProfile, metaStoreFromSqlRoster } from './orgRosterSql.js'

describe('orgRosterSql mapping', () => {
  it('maps a SQL profile to a team member without the users blob', () => {
    const member = teamMemberFromSqlProfile({
      legacy_user_id: 'user-1',
      full_name: 'Revenue B2B',
      email: 'revenueb2b@xindus.net',
      role: 'admin',
      pipeline_role: 'org_admin',
      team_id: 'team-sales',
      department_id: 'dept-sales',
    })
    assert.equal(member.userId, 'user-1')
    assert.equal(member.role, 'org_admin')
    assert.equal(member.teamId, 'team-sales')
    assert.equal(member.status, 'active')
  })

  it('builds a membership the owner index can use', () => {
    const membership = membershipFromSqlProfile(
      { legacy_user_id: 'u-vivek', role: 'rep', pipeline_role: 'member', email: 'vivek@xindus.net' },
      'org-xindus'
    )
    assert.equal(membership.userId, 'u-vivek')
    assert.equal(membership.organizationId, 'org-xindus')
    assert.equal(membership.role, 'member')
    assert.equal(membership.status, 'active')
  })

  it('falls back to the session user when SQL roster is empty', () => {
    const store = metaStoreFromSqlRoster(
      { users: [], organizations: [], organizationMemberships: [] },
      { id: 'session-1', email: 'revenueb2b@xindus.net' }
    )
    assert.equal(store.users[0].id, 'session-1')
  })
})
