import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { updateMasterContactById } from './pipelineContact.js'

describe('updateMasterContactById', () => {
  it('syncs email and phone onto linked pipeline lead snapshot', () => {
    const store = {
      organizations: [{ id: 'org1', name: 'Test Org' }],
      organizationMemberships: [
        { userId: 'u1', organizationId: 'org1', role: 'org_admin', status: 'active' },
      ],
      users: [{ id: 'u1', organizationId: 'org1', accountType: 'company' }],
      contacts: [
        {
          id: 'c1',
          firstName: 'Sulay',
          lastName: 'Lavsi',
          companyId: 'co1',
          email: '',
          phone: '',
        },
      ],
      companies: [{ id: 'co1', name: 'Bummer', city: '', state: '' }],
      savedLeads: [
        {
          id: 'saved1',
          userId: 'u1',
          organizationId: 'org1',
          assignedToUserId: 'u1',
          contactId: 'c1',
          lead: {
            id: 'c1',
            firstName: 'Sulay',
            lastName: 'Lavsi',
            company: 'Bummer',
            email: '',
            phone: '',
          },
          crm: { status: 'new' },
        },
      ],
    }
    const user = { id: 'u1', organizationId: 'org1', accountType: 'company', isOrgAdmin: true }

    const shaped = updateMasterContactById(store, user, 'c1', {
      email: 'hr@bummer.in',
      phone: '+91-9876543210',
    })

    assert.equal(shaped.email, 'hr@bummer.in')
    assert.equal(shaped.phone, '+91-9876543210')
    assert.equal(store.contacts[0].email, 'hr@bummer.in')
    assert.equal(store.savedLeads[0].lead.email, 'hr@bummer.in')
    assert.equal(store.savedLeads[0].lead.phone, '+91-98765-43210')
  })
})
