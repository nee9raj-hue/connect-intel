import test from 'node:test'
import assert from 'node:assert/strict'
import { addManualPipelineLead } from './manualPipelineLead.js'

function baseStore() {
  return {
    savedLeads: [],
    contacts: [],
    companies: [],
    importJobs: [],
    users: [{ id: 'rep1', email: 'rep@test.com', name: 'Rep' }],
    organizations: [{ id: 'org1', name: 'Test Co' }],
    organizationMemberships: [
      { userId: 'rep1', organizationId: 'org1', role: 'member', status: 'active' },
    ],
    crmPipelines: [],
    marketingEvents: [],
  }
}

test('addManualPipelineLead does not throw when workflow CRM helpers run', () => {
  const store = baseStore()
  const user = { id: 'rep1', email: 'rep@test.com', name: 'Rep', organizationId: 'org1', accountType: 'company' }
  const lead = addManualPipelineLead(store, {
    user,
    organizationId: 'org1',
    fields: {
      firstName: 'Vikas',
      lastName: 'Rajani',
      company: 'Curo Bag',
      phone: '9462434912',
      city: 'Udaipur',
      state: 'Rajasthan',
      status: 'new',
      commercialEmailOptIn: true,
    },
  })
  assert.ok(lead?.id)
  assert.equal(store.savedLeads.length, 1)
  assert.ok(store.savedLeads[0].crm?.status)
})

test('addManualPipelineLead blocks duplicate by name, company, and LinkedIn', () => {
  const store = baseStore()
  const user = { id: 'rep1', email: 'rep@test.com', name: 'Rep', organizationId: 'org1', accountType: 'company' }

  addManualPipelineLead(store, {
    user,
    organizationId: 'org1',
    fields: {
      firstName: 'Sulay',
      lastName: 'Lavsi',
      company: 'Bummer',
      linkedin: 'https://www.linkedin.com/in/sulaylavsi/',
      status: 'new',
    },
  })

  let duplicateError = null
  try {
    addManualPipelineLead(store, {
      user,
      organizationId: 'org1',
      fields: {
        firstName: 'Sulay',
        lastName: 'Lavsi',
        company: 'Bummer',
        linkedin: 'https://linkedin.com/in/sulaylavsi',
        status: 'new',
      },
    })
  } catch (err) {
    duplicateError = err
  }
  assert.ok(duplicateError)
  assert.ok(duplicateError.message.includes('already exists'))
  assert.equal(store.savedLeads.length, 1)
})
