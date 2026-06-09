import { buildPipelineIndexDoc, applyPipelineSummaryForUser } from '../lib/server/pipelineIndex.js'
import { applyIncrementalPipelineIndex } from '../lib/server/pipelineIndexDelta.js'
import { CRM_STATUSES } from '../lib/server/crm.js'

const entries = [
  {
    id: 's1',
    userId: 'u1',
    assignedToUserId: 'u1',
    organizationId: 'org-x',
    savedAt: '2026-01-01T00:00:00.000Z',
    lead: { id: 'l1', company: 'Acme', city: 'Mumbai', state: 'Maharashtra' },
    crm: { status: 'new' },
  },
  {
    id: 's2',
    userId: 'u2',
    assignedToUserId: 'u2',
    organizationId: 'org-x',
    savedAt: '2026-01-02T00:00:00.000Z',
    lead: { id: 'l2', company: 'Beta', city: 'Delhi', state: 'Delhi NCR' },
    crm: { status: 'contacted' },
  },
  {
    id: 's3',
    userId: 'u1',
    assignedToUserId: 'u1',
    organizationId: 'org-x',
    savedAt: '2026-01-03T00:00:00.000Z',
    lead: { id: 'l3', company: 'Gamma', city: 'Mumbai', state: 'Maharashtra' },
    crm: { status: 'new', deals: [{ id: 'd1', stage: 'rfq' }] },
  },
]

const doc = buildPipelineIndexDoc(entries, { freightOrg: true, organizationId: 'org-x' })
if (doc.total !== 3) {
  console.error('Expected total 3, got', doc.total)
  process.exit(1)
}
if (!doc.cities.includes('Mumbai')) {
  console.error('Expected Mumbai in cities')
  process.exit(1)
}
if (!doc.byAssignee.u1 || doc.byAssignee.u1.total !== 2) {
  console.error('Expected u1 bucket with 2 leads')
  process.exit(1)
}

const adminUser = { id: 'admin', organizationId: 'org-x', accountType: 'company' }
const memberUser = { id: 'u2', organizationId: 'org-x', accountType: 'company' }
const store = {
  users: [adminUser, memberUser],
  organizations: [{ id: 'org-x', name: 'Test', ownerUserId: 'admin' }],
  organizationMemberships: [
    { userId: 'admin', organizationId: 'org-x', role: 'org_admin' },
    { userId: 'u2', organizationId: 'org-x', role: 'member' },
  ],
}

const adminSummary = applyPipelineSummaryForUser(doc, adminUser, store)
if (adminSummary.total !== 3) {
  console.error('Admin summary total wrong', adminSummary.total)
  process.exit(1)
}

const memberSummary = applyPipelineSummaryForUser(doc, memberUser, store)
if (memberSummary.total !== 1) {
  console.error('Member summary total wrong', memberSummary.total)
  process.exit(1)
}
if (memberSummary.byStatus.find((r) => r.status === 'contacted')?.count !== 1) {
  console.error('Member byStatus wrong')
  process.exit(1)
}

if (!CRM_STATUSES.length) {
  process.exit(1)
}

const prevEntry = entries[0]
const nextEntry = {
  ...prevEntry,
  crm: { ...prevEntry.crm, status: 'contacted' },
  assignedToUserId: 'u2',
}
const incremental = applyIncrementalPipelineIndex(doc, prevEntry, nextEntry, { freightOrg: true })
if (!incremental || incremental.byStatus.find((r) => r.status === 'new')?.count !== 1) {
  console.error('Incremental byStatus new count wrong', incremental?.byStatus)
  process.exit(1)
}
if (incremental.byStatus.find((r) => r.status === 'contacted')?.count !== 2) {
  console.error('Incremental byStatus contacted count wrong', incremental?.byStatus)
  process.exit(1)
}
if (!incremental.byAssignee.u2 || incremental.byAssignee.u2.total !== 2) {
  console.error('Incremental assignee bucket wrong', incremental?.byAssignee)
  process.exit(1)
}

console.log('✓ Pipeline index regression passed')
