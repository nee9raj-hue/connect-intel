import assert from 'node:assert/strict'
import { getVisiblePipelineColumns, canMoveLeadToStatus } from '../lib/server/pipelineRoles.js'
import { CRM_STATUSES } from '../frontend/src/lib/crmConstants.js'

const allIds = CRM_STATUSES.map((c) => c.id)

for (const pipelineRole of ['member', 'sales', 'manager', 'org_admin']) {
  const cols = getVisiblePipelineColumns('member', pipelineRole)
  assert.equal(cols.length, CRM_STATUSES.length, `${pipelineRole} should see all stages`)
  assert.deepEqual(
    cols.map((c) => c.id),
    allIds,
    `${pipelineRole} column ids should match CRM_STATUSES`
  )
}

for (const status of allIds) {
  assert.equal(
    canMoveLeadToStatus('member', 'sales', status),
    true,
    `legacy sales role should move to ${status}`
  )
}

console.log('test-pipeline-role-columns: ok')
