import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  listOrganizationsNeedingSqlSync,
  listProfilesNeedingSqlSync,
  orgUuidFromStore,
  profileUuidFromStore,
} from './orgSqlResolve.js'

describe('orgUuidFromStore', () => {
  it('returns sqlOrganizationId when present', () => {
    const store = {
      organizations: [{ id: 'org_1', sqlOrganizationId: 'uuid-1' }],
    }
    assert.equal(orgUuidFromStore(store, 'org_1'), 'uuid-1')
  })

  it('returns null when org missing sql id', () => {
    const store = { organizations: [{ id: 'org_1' }] }
    assert.equal(orgUuidFromStore(store, 'org_1'), null)
  })
})

describe('profileUuidFromStore', () => {
  it('returns sqlProfileId when present', () => {
    const store = { users: [{ id: 'u1', sqlProfileId: 'prof-1' }] }
    assert.equal(profileUuidFromStore(store, 'u1'), 'prof-1')
  })
})

describe('listOrganizationsNeedingSqlSync', () => {
  it('lists company orgs without sqlOrganizationId', () => {
    const store = {
      organizations: [
        { id: 'org_a', accountType: 'company' },
        { id: 'org_b', accountType: 'company', sqlOrganizationId: 'uuid-b' },
        { id: 'solo', accountType: 'individual' },
      ],
    }
    const pending = listOrganizationsNeedingSqlSync(store)
    assert.equal(pending.length, 1)
    assert.equal(pending[0].id, 'org_a')
  })
})

describe('listProfilesNeedingSqlSync', () => {
  it('lists company members missing sqlProfileId', () => {
    const store = {
      organizations: [{ id: 'org_a', accountType: 'company', ownerUserId: 'u_owner' }],
      organizationMemberships: [
        { userId: 'u1', organizationId: 'org_a', status: 'active' },
        { userId: 'u2', organizationId: 'org_a', status: 'active' },
      ],
      users: [
        { id: 'u1', email: 'a@x.com' },
        { id: 'u2', email: 'b@x.com', sqlProfileId: 'prof-2' },
        { id: 'u_owner', email: 'owner@x.com' },
      ],
    }
    const pending = listProfilesNeedingSqlSync(store)
    assert.equal(pending.length, 2)
    assert.ok(pending.some((p) => p.userId === 'u1'))
    assert.ok(pending.some((p) => p.userId === 'u_owner'))
  })
})
