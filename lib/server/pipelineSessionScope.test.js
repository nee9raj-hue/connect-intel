import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOrgRole } from './organizations.js'
import { pipelineMetaStoreFromSessionUser } from './pipelineShard.js'
import { resolvePipelineTableScope } from './pipelineTableScope.js'

describe('session pipeline scope', () => {
  it('treats a JWT company admin as org_admin without the users blob', () => {
    const user = {
      id: 'u-rev',
      email: 'revenueb2b@xindus.net',
      organizationId: 'org-xindus',
      accountType: 'company',
      orgRole: 'org_admin',
      isOrgAdmin: true,
      organizationName: 'Xindus Network Trade',
    }
    const role = resolveOrgRole(user, { users: [], organizations: [], organizationMemberships: [] })
    assert.equal(role.orgRole, 'org_admin')
    assert.equal(role.accountType, 'company')

    const meta = pipelineMetaStoreFromSessionUser(user)
    const scope = resolvePipelineTableScope(user, meta, {})
    assert.equal(scope.organizationId, 'org-xindus')
    assert.equal(scope.ownerId, undefined)
  })

  it('keeps reps scoped to their own book', () => {
    const user = {
      id: 'u-rep',
      organizationId: 'org-xindus',
      accountType: 'company',
      orgRole: 'member',
      isOrgAdmin: false,
    }
    const scope = resolvePipelineTableScope(user, pipelineMetaStoreFromSessionUser(user), {})
    assert.equal(scope.ownerId, 'u-rep')
  })
})
