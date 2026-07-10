import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWorkspaceLookupForUser,
  emailDomainFromAddress,
  listOrgAdminMembers,
} from './orgWorkspaceAccess.js'
import { findCompanyOrganizationByDomain } from './organizations.js'

const store = {
  users: [
    { id: 'u-admin', email: 'admin@xindus.net', name: 'Admin' },
    { id: 'u-rep', email: 'revenueb2b@xindus.net', name: 'Revenue' },
  ],
  organizations: [
    {
      id: 'org-x',
      name: 'Xindus Network',
      domain: 'xindus.net',
      accountType: 'company',
      ownerUserId: 'u-admin',
      accessRequests: [],
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

describe('orgWorkspaceAccess', () => {
  it('finds company org by email domain', () => {
    assert.equal(emailDomainFromAddress('revenueb2b@xindus.net'), 'xindus.net')
    const org = findCompanyOrganizationByDomain(store, 'xindus.net')
    assert.equal(org?.id, 'org-x')
  })

  it('builds lookup for user outside existing company org', () => {
    const lookup = buildWorkspaceLookupForUser(store, store.users[1])
    assert.equal(lookup.companyWorkspaceExists, true)
    assert.equal(lookup.organizationName, 'Xindus Network')
    assert.equal(lookup.alreadyMember, false)
    assert.equal(lookup.adminContacts.length, 1)
  })

  it('lists org admin contacts', () => {
    const admins = listOrgAdminMembers(store, 'org-x')
    assert.equal(admins.length, 1)
    assert.equal(admins[0].email, 'admin@xindus.net')
  })
})
