import test from 'node:test'
import assert from 'node:assert/strict'
import { orgMemberUserIdSet } from './orgMemberSet.js'
import { enforceOrgMembershipOnPipelineEntries } from './tenantPipelineCleanup.js'

const metaStore = {
  organizations: [{ id: 'org-xindus', name: 'Xindus', ownerUserId: 'admin-x' }],
  organizationMemberships: [
    { id: 'm1', organizationId: 'org-xindus', userId: 'rep-x', role: 'member', status: 'active' },
    { id: 'm2', organizationId: 'org-alvar', userId: 'rep-alvar', role: 'member', status: 'active' },
  ],
  users: [
    { id: 'admin-x', organizationId: 'org-xindus', name: 'Xindus Admin', email: 'admin@xindus.net' },
    { id: 'rep-x', organizationId: 'org-xindus', name: 'Neeraj Kumar', email: 'neeraj@xindus.net' },
    { id: 'rep-alvar', organizationId: 'org-alvar', name: 'Alvar Sales', email: 'sales@alvarfresh.com' },
  ],
}

test('orgMemberUserIdSet includes only org members and owner', () => {
  const ids = orgMemberUserIdSet(metaStore, 'org-xindus')
  assert.ok(ids.has('admin-x'))
  assert.ok(ids.has('rep-x'))
  assert.equal(ids.has('rep-alvar'), false)
})

test('enforceOrgMembershipOnPipelineEntries clears foreign assignee', () => {
  const entries = [
    {
      organizationId: 'org-xindus',
      assignedToUserId: 'rep-alvar',
      savedByUserId: 'rep-alvar',
      lead: { id: 'lead-1' },
    },
    {
      organizationId: 'org-xindus',
      assignedToUserId: 'rep-x',
      savedByUserId: 'rep-x',
      lead: { id: 'lead-2' },
    },
  ]
  const out = enforceOrgMembershipOnPipelineEntries(metaStore, entries)
  assert.equal(out[0].assignedToUserId, null)
  assert.equal(out[1].assignedToUserId, 'rep-x')
})

test('foreign owner ids are excluded from member set used by roster', () => {
  const memberIds = orgMemberUserIdSet(metaStore, 'org-xindus')
  const pipelineOwners = ['rep-x', 'rep-alvar']
  const activityActors = ['rep-alvar']
  const indexAssignees = Object.keys({ 'rep-alvar': 1, 'rep-x': 3 })

  const allowedOwners = pipelineOwners.filter((id) => memberIds.has(String(id)))
  const allowedActors = activityActors.filter((id) => memberIds.has(String(id)))
  const allowedIndex = indexAssignees.filter((id) => memberIds.has(String(id)))

  assert.deepEqual(allowedOwners, ['rep-x'])
  assert.deepEqual(allowedActors, [])
  assert.deepEqual(allowedIndex, ['rep-x'])
})
