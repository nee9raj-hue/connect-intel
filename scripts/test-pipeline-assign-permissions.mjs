import assert from 'node:assert/strict'
import {
  buildOrgUserResponse,
  canAssignLead,
  isCompanyPipelineManager,
} from '../lib/server/organizations.js'

const orgId = 'org-xindus'
const store = {
  users: [
    { id: 'admin1', email: 'admin@xindus.net', organizationId: orgId, accountType: 'company' },
    { id: 'mgr1', email: 'mgr@xindus.net', organizationId: orgId, accountType: 'company' },
    { id: 'rep1', email: 'rep@xindus.net', organizationId: orgId, accountType: 'company' },
  ],
  organizations: [{ id: orgId, accountType: 'company', ownerUserId: 'admin1' }],
  organizationMemberships: [
    { userId: 'admin1', organizationId: orgId, role: 'org_admin', pipelineRole: 'org_admin' },
    { userId: 'mgr1', organizationId: orgId, role: 'member', pipelineRole: 'manager' },
    { userId: 'rep1', organizationId: orgId, role: 'member', pipelineRole: 'member' },
  ],
}

const admin = buildOrgUserResponse(store.users[0], store)
const manager = buildOrgUserResponse(store.users[1], store)
const rep = buildOrgUserResponse(store.users[2], store)

assert.equal(admin.isOrgAdmin, true, 'admin session should be org admin')
assert.equal(isCompanyPipelineManager(admin, store), true)
assert.equal(isCompanyPipelineManager(manager, store), true, 'pipeline manager counts as manager')

const ownedEntry = { assignedToUserId: 'rep1', organizationId: orgId }
const otherEntry = { assignedToUserId: 'mgr1', organizationId: orgId }
const unassignedEntry = { assignedToUserId: null, organizationId: orgId }

assert.equal(canAssignLead(admin, otherEntry, 'rep1'), true)
assert.equal(canAssignLead(manager, otherEntry, 'rep1'), true)
assert.equal(canAssignLead(rep, ownedEntry, 'mgr1'), true, 'owner can reassign to teammate')
assert.equal(canAssignLead(rep, otherEntry, 'rep1'), false, 'rep cannot take others lead')
assert.equal(canAssignLead(rep, unassignedEntry, 'rep1'), true, 'rep can claim unassigned')
assert.equal(canAssignLead(rep, unassignedEntry, 'mgr1'), false, 'rep cannot assign unassigned to others')

// Raw store user lacks isOrgAdmin — enriched session must be used for bulk assign.
const rawAdmin = store.users[0]
assert.equal(Boolean(rawAdmin.isOrgAdmin), false, 'raw user has no isOrgAdmin flag')
assert.equal(isCompanyPipelineManager(buildOrgUserResponse(rawAdmin, store), store), true)

console.log('test-pipeline-assign-permissions: ok')
