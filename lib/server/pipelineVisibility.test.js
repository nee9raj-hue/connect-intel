import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findPipelineEntryWithScope,
  isPipelineEntryInUserOrg,
  canUserDeletePipelineEntry,
} from './pipelineVisibility.js'

const metaStore = {
  users: [],
  organizations: [{ id: 'org1', accountType: 'company', ownerUserId: 'admin1' }],
  organizationMemberships: [],
}

function entry(overrides = {}) {
  return {
    organizationId: 'org1',
    assignedToUserId: null,
    savedByUserId: 'rep1',
    userId: 'rep1',
    lead: { id: 'lead1', firstName: 'A' },
    ...overrides,
  }
}

function storeWith(entries) {
  return { ...metaStore, savedLeads: entries }
}

test('findPipelineEntryWithScope — rep sees own and open pool only', () => {
  const store = storeWith([
    entry(),
    entry({ assignedToUserId: 'rep2', savedByUserId: 'rep2', lead: { id: 'lead2' } }),
    entry({ assignedToUserId: null, savedByUserId: 'rep2', lead: { id: 'lead3' } }),
  ])
  const rep = { id: 'rep1', organizationId: 'org1', accountType: 'company', orgRole: 'member' }
  assert.ok(findPipelineEntryWithScope(store, rep, 'lead1'))
  assert.equal(findPipelineEntryWithScope(store, rep, 'lead2'), null)
  assert.equal(findPipelineEntryWithScope(store, rep, 'lead3'), null)
})

test('findPipelineEntryWithScope — admin sees all in org', () => {
  const store = storeWith([entry({ assignedToUserId: 'rep2', savedByUserId: 'rep2' })])
  const admin = {
    id: 'admin1',
    organizationId: 'org1',
    accountType: 'company',
    orgRole: 'org_admin',
    isOrgAdmin: true,
  }
  assert.ok(findPipelineEntryWithScope(store, admin, 'lead1'))
})

test('isPipelineEntryInUserOrg blocks cross-org', () => {
  const user = { id: 'u1', organizationId: 'org1', accountType: 'company' }
  assert.ok(isPipelineEntryInUserOrg(user, entry()))
  assert.equal(isPipelineEntryInUserOrg(user, entry({ organizationId: 'org2' })), false)
})

test('canUserDeletePipelineEntry — rep only own assigned', () => {
  const rep = { id: 'rep1', organizationId: 'org1', accountType: 'company', orgRole: 'member' }
  assert.ok(canUserDeletePipelineEntry(rep, entry({ assignedToUserId: 'rep1' }), metaStore))
  assert.equal(
    canUserDeletePipelineEntry(
      rep,
      entry({ assignedToUserId: 'rep2', savedByUserId: 'rep2', userId: 'rep2' }),
      metaStore
    ),
    false
  )
})

test('canUserDeletePipelineEntry — admin can delete team lead', () => {
  const admin = { id: 'admin1', organizationId: 'org1', accountType: 'company', orgRole: 'org_admin', isOrgAdmin: true }
  assert.ok(canUserDeletePipelineEntry(admin, entry({ assignedToUserId: 'rep2' }), metaStore))
})
