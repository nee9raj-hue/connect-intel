import { buildTeamActivityTimeline } from '../lib/server/teamActivityTimeline.js'

const store = {
  users: [
    { id: 'admin', organizationId: 'org-x', isOrgAdmin: true, email: 'admin@xindus.net' },
    { id: 'rep1', organizationId: 'org-x', email: 'rep@xindus.net' },
  ],
  organizations: [{ id: 'org-x', name: 'Xindus', ownerUserId: 'admin' }],
  organizationMemberships: [
    { userId: 'admin', organizationId: 'org-x', role: 'org_admin' },
    { userId: 'rep1', organizationId: 'org-x', role: 'member' },
  ],
}
const user = { id: 'admin', organizationId: 'org-x', isOrgAdmin: true, accountType: 'company' }
const entries = [
  {
    id: 's1',
    assignedToUserId: 'rep1',
    lead: { id: 'l1', company: 'Acme Exports', firstName: 'Raj' },
    crm: {
      activities: [
        {
          id: 'a1',
          type: 'call',
          summary: 'Discussed RFQ for Mumbai lane — will send quote tomorrow',
          createdAt: '2026-06-04T10:00:00.000Z',
          createdByUserId: 'rep1',
          createdByName: 'Sales Rep',
        },
      ],
      deals: [
        {
          id: 'd1',
          name: 'Mumbai FCL',
          stage: 'rfq',
          amount: 120000,
          createdAt: '2026-06-04T09:00:00.000Z',
          createdByUserId: 'rep1',
          createdByName: 'Sales Rep',
        },
      ],
    },
  },
]

const since = new Date('2026-06-01').getTime()
const timeline = buildTeamActivityTimeline(store, user, entries, {
  since,
  memberUserId: 'rep1',
  limit: 20,
  freightOrg: true,
})

if (!timeline.some((t) => t.type === 'call' && t.body.includes('RFQ'))) {
  console.error('Expected call with remarks in timeline')
  process.exit(1)
}
if (!timeline.some((t) => t.type === 'deal_created')) {
  console.error('Expected deal_created in timeline')
  process.exit(1)
}

console.log('✓ Team activity timeline regression passed')
