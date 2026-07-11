import assert from 'node:assert/strict'
import test from 'node:test'
import {
  leadToSearchDoc,
  companyToSearchDoc,
  contactToSearchDoc,
  countExpectedMeilisearchDocs,
  countExpectedOrgMeilisearchDocs,
} from './server/meilisearch/sync.js'

test('leadToSearchDoc maps pipeline entry fields for Meilisearch', () => {
  const doc = leadToSearchDoc(
    {
      organizationId: 'org-1',
      assignedToUserId: 'user-a',
      savedByUserId: 'user-b',
      userId: 'user-b',
      crm: { status: 'contacted' },
      lead: {
        id: 'lead-1',
        name: 'Acme Corp',
        email: 'ops@acme.com',
        company: 'Acme',
        title: 'CEO',
      },
      updatedAt: '2026-06-24T00:00:00.000Z',
    },
    'org-1'
  )

  assert.equal(doc.id, 'lead_lead-1')
  assert.equal(doc.type, 'lead')
  assert.equal(doc.organizationId, 'org-1')
  assert.equal(doc.leadId, 'lead-1')
  assert.equal(doc.name, 'Acme Corp')
  assert.equal(doc.email, 'ops@acme.com')
  assert.equal(doc.status, 'contacted')
  assert.equal(doc.ownerUserId, 'user-a')
  assert.equal(doc.assignedToUserId, 'user-a')
})

test('countExpectedMeilisearchDocs includes leads and deals', () => {
  const total = countExpectedMeilisearchDocs([
    {
      lead: { id: 'l1' },
      crm: { deals: [{ id: 'd1' }, { id: 'd2' }] },
    },
    { lead: { id: 'l2' }, crm: { deals: [] } },
  ])
  assert.equal(total, 4)
})

test('companyToSearchDoc maps account fields', () => {
  const doc = companyToSearchDoc(
    { id: 'co-1', name: 'Xindus', domain: 'xindus.com', leadCount: 12 },
    'org-1'
  )
  assert.equal(doc.id, 'company_co-1')
  assert.equal(doc.type, 'company')
  assert.equal(doc.domain, 'xindus.com')
  assert.equal(doc.subtitle, '12 contacts')
})

test('countExpectedOrgMeilisearchDocs includes meta objects', () => {
  const store = {
    contacts: [{ id: 'c1', organizationId: 'org-1' }],
    companies: [{ id: 'co1', organizationId: 'org-1' }],
    marketingCampaigns: [],
    teamNotes: [],
    teamTasks: [],
    chithiMessages: [],
  }
  const total = countExpectedOrgMeilisearchDocs([], store, 'org-1', { sqlCompanyCount: 5 })
  assert.equal(total, 6)
})
