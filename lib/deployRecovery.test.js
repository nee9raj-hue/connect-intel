import test from 'node:test'
import assert from 'node:assert/strict'
import { isStaleAssetError } from '../frontend/src/lib/deployRecovery.js'

test('stale PWA chunk errors are detected after a deploy', () => {
  assert.equal(
    isStaleAssetError('Failed to fetch dynamically imported module: /assets/PipelinePanel-abc.js'),
    true
  )
  assert.equal(isStaleAssetError('PipelineDealsView is not defined'), true)
})

test('normal pipeline errors are not treated as a cache miss', () => {
  assert.equal(isStaleAssetError('Request timeout'), false)
})
