import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marketingSnapshotCollection } from './marketingSnapshots.js'
import { pipelineSnapshotCollection } from './dashboardSnapshots.js'

test('marketingSnapshotCollection', () => {
  assert.equal(marketingSnapshotCollection('org_abc'), 'marketing_snapshot_org_abc')
})

test('pipelineSnapshotCollection', () => {
  assert.equal(pipelineSnapshotCollection('org_abc'), 'pipeline_snapshot_org_abc')
})
