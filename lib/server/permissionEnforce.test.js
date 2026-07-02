import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertPipelineHubAccess,
  assertPlatformSearchAccess,
  mapUserToPermissionRole,
  userHasOrgPermission,
} from './permissionEnforce.js'

describe('mapUserToPermissionRole', () => {
  it('maps solo user to admin', () => {
    assert.equal(mapUserToPermissionRole({ accountType: 'individual' }, {}), 'admin')
  })

  it('maps company rep to rep', () => {
    const user = {
      organizationId: 'org1',
      accountType: 'company',
      pipelineRole: 'member',
    }
    const store = {
      organizationMemberships: [{ userId: user.id, organizationId: 'org1', pipelineRole: 'member' }],
      users: [user],
      organizations: [{ id: 'org1' }],
    }
    assert.equal(mapUserToPermissionRole({ ...user, id: 'u1' }, store), 'rep')
  })
})

describe('assertPipelineHubAccess', () => {
  it('allows solo users without store', async () => {
    await assertPipelineHubAccess({ accountType: 'individual', id: 'u1' }, {})
  })

  it('allows company rep with edit_leads', async () => {
    const user = { id: 'u1', organizationId: 'org1', accountType: 'company', pipelineRole: 'member' }
    const store = {
      users: [user],
      organizations: [{ id: 'org1' }],
      organizationMemberships: [{ userId: 'u1', organizationId: 'org1', pipelineRole: 'member' }],
    }
    await assertPipelineHubAccess(user, store)
    assert.equal(await userHasOrgPermission(user, 'edit_leads', store), true)
  })
})

describe('assertPlatformSearchAccess', () => {
  it('allows marketing manager via access_marketing', async () => {
    const user = {
      id: 'u1',
      organizationId: 'org1',
      accountType: 'company',
      marketingRole: 'marketing_manager',
    }
    const store = {
      users: [user],
      organizations: [{ id: 'org1' }],
      organizationMemberships: [
        { userId: 'u1', organizationId: 'org1', marketingRole: 'marketing_manager' },
      ],
    }
    await assertPlatformSearchAccess(user, store)
  })

  it('allows company rep with edit_leads to access marketing', async () => {
    const user = { id: 'u1', organizationId: 'org1', accountType: 'company', pipelineRole: 'member' }
    const store = {
      users: [user],
      organizations: [{ id: 'org1' }],
      organizationMemberships: [{ userId: 'u1', organizationId: 'org1', pipelineRole: 'member' }],
    }
    assert.equal(await userHasOrgPermission(user, 'access_marketing', store), true)
    assert.equal(await userHasOrgPermission(user, 'send_campaigns', store), true)
  })
})
