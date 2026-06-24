import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalActivityPeriod } from './crmActivityScope.js'

test('canonicalActivityPeriod normalizes UI aliases', () => {
  assert.equal(canonicalActivityPeriod('week'), '7d')
  assert.equal(canonicalActivityPeriod('month'), '30d')
  assert.equal(canonicalActivityPeriod('7d'), '7d')
  assert.equal(canonicalActivityPeriod('day'), 'day')
})
