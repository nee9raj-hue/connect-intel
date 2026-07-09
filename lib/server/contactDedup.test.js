import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findDuplicateContactGroups, mergeMasterContacts } from './contactDedup.js'

const user = { id: 'u1', organizationId: 'org1', accountType: 'company', isOrgAdmin: true }

function baseStore() {
  return {
    users: [user],
    organizations: [{ id: 'org1' }],
    organizationMemberships: [{ userId: 'u1', organizationId: 'org1', pipelineRole: 'manager' }],
    companies: [
      { id: 'co1', name: 'Acme Corp', domain: 'acme.com', organizationId: 'org1' },
    ],
    contacts: [
      {
        id: 'c1',
        companyId: 'co1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@acme.com',
        organizationId: 'org1',
      },
      {
        id: 'c2',
        companyId: 'co1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@acme.com',
        organizationId: 'org1',
      },
    ],
    savedLeads: [
      {
        organizationId: 'org1',
        contactId: 'c1',
        lead: { id: 'c1', firstName: 'Jane', lastName: 'Doe', company: 'Acme Corp' },
        crm: { status: 'new' },
      },
      {
        organizationId: 'org1',
        contactId: 'c2',
        lead: { id: 'c2', firstName: 'Jane', lastName: 'Doe', company: 'Acme Corp' },
        crm: { status: 'replied' },
      },
    ],
  }
}

describe('contactDedup', () => {
  it('groups contacts with matching names at same company', () => {
    const groups = findDuplicateContactGroups(baseStore(), user)
    assert.equal(groups.length, 1)
    assert.equal(groups[0].contacts.length, 2)
    assert.ok(groups[0].mergeContactIds.includes('c2'))
  })

  it('merges secondary contacts into primary and re-points pipeline entries', () => {
    const store = baseStore()
    const result = mergeMasterContacts(store, user, 'c1', ['c2'])
    assert.equal(result.mergedCount, 1)
    assert.equal(store.contacts.length, 1)
    assert.equal(store.contacts[0].id, 'c1')
    assert.equal(store.savedLeads.filter((e) => e.contactId === 'c1').length, 2)
    assert.ok(result.contact.email)
  })
})
