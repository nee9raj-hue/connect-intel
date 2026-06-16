import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPipelineLeadsScopedQuery } from './pipelineLeadsTable.js'

test('buildPipelineLeadsScopedQuery applies rep visibility when hierarchy scope flags are set', () => {
  const qs = buildPipelineLeadsScopedQuery(
    'pipeline_org_xindus',
    {
      organizationId: 'org-xindus',
      repOwnAndUnassigned: true,
      viewerUserId: 'pakhi-id',
      role: 'rep',
    },
    { offset: 0, limit: 50 }
  )
  assert.match(qs, /organization_id=eq\.org-xindus/)
  assert.match(qs, /owner_id\.eq\.pakhi-id/)
  assert.match(qs, /owner_id\.is\.null/)
})

test('buildPipelineLeadsScopedQuery keeps legacy includeUnassigned path', () => {
  const qs = buildPipelineLeadsScopedQuery(
    'pipeline_org_xindus',
    { organizationId: 'org-xindus', ownerId: 'rep1', includeUnassigned: true },
    { offset: 0, limit: 25 }
  )
  assert.match(qs, /owner_id\.eq\.rep1/)
  assert.match(qs, /owner_id\.is\.null/)
})
