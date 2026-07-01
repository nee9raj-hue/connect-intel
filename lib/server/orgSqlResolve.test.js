import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  listOrganizationsNeedingSqlSync,
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
