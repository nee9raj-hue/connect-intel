import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { grantOrgAdminOnStore } from './orgMembershipAdmin.js'
import { buildOrgUserResponse } from './organizations.js'

describe('grantOrgAdminOnStore', () => {
  it('joins domain-matched user and grants org admin', () => {
    const store = {
      users: [
        { id: 'u-admin', email: 'owner@xindus.net', name: 'Owner' },
        { id: 'u-neeraj', email: 'neeraj.kumar@xindus.net', name: 'Neeraj', accountType: 'individual' },
      ],
      organizations: [
        {
          id: 'org-x',
          name: 'Xindus Network',
          domain: 'xindus.net',
          accountType: 'company',
          ownerUserId: 'u-admin',
        },
      ],
      organizationMemberships: [
        {
          id: 'm1',
          userId: 'u-admin',
          organizationId: 'org-x',
          role: 'org_admin',
          pipelineRole: 'org_admin',
          status: 'active',
        },
      ],
    }

    const user = store.users[1]
    const org = grantOrgAdminOnStore(store, user, { demoteOtherAdmins: true })
    assert.equal(org.id, 'org-x')
    assert.equal(user.organizationId, 'org-x')
    assert.equal(user.accountType, 'company')
    assert.equal(user.onboardingComplete, true)

    const enriched = buildOrgUserResponse(user, store)
    assert.equal(enriched.isOrgAdmin, true)

    const oldAdmin = store.organizationMemberships.find((m) => m.userId === 'u-admin')
    assert.equal(oldAdmin.role, 'member')
  })
})
