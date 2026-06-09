import { hasHeavyPipelineListFilters } from '../lib/server/pipelineListLoad.js'
import { resolvePipelineTableScope } from '../lib/server/pipelineTableScope.js'
import { buildPipelineLeadsScopedQuery } from '../lib/server/pipelineLeadsTable.js'

const metaStore = {
  users: [{ id: 'u1' }, { id: 'admin' }],
  organizations: [{ id: 'org-x', ownerUserId: 'admin' }],
  organizationMemberships: [
    { userId: 'admin', organizationId: 'org-x', role: 'org_admin' },
    { userId: 'u1', organizationId: 'org-x', role: 'member' },
  ],
}

const admin = { id: 'admin', organizationId: 'org-x', accountType: 'company' }
const member = { id: 'u1', organizationId: 'org-x', accountType: 'company' }

if (!hasHeavyPipelineListFilters({ status: 'new' })) {
  // ok
} else {
  console.error('status-only should not be heavy')
  process.exit(1)
}

if (!hasHeavyPipelineListFilters({ q: 'acme' })) {
  console.error('q search should be heavy')
  process.exit(1)
}

const adminScope = resolvePipelineTableScope(admin, metaStore, {})
if (adminScope.organizationId !== 'org-x' || adminScope.assigneeUserId) {
  console.error('admin scope wrong', adminScope)
  process.exit(1)
}

const memberScope = resolvePipelineTableScope(member, metaStore, {})
if (memberScope.assigneeUserId !== 'u1') {
  console.error('member scope wrong', memberScope)
  process.exit(1)
}

const qs = buildPipelineLeadsScopedQuery('pipeline_org_org-x', memberScope, {
  offset: 0,
  limit: 50,
  status: 'contacted',
})
if (!qs.includes('assignedToUserId') || !qs.includes('status=eq.contacted')) {
  console.error('scoped query wrong', qs)
  process.exit(1)
}

console.log('✓ Pipeline list load regression passed')
