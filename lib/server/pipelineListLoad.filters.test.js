import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasHeavyPipelineListFilters,
  isMeiliSearchOnlyFilters,
} from './pipelineListLoad.js'

test('follow-up filters are not heavy (SQL path eligible)', () => {
  assert.equal(hasHeavyPipelineListFilters({ followUpDue: true }), false)
  assert.equal(hasHeavyPipelineListFilters({ overdueFollowUp: true }), false)
})

test('text search alone is Meili-eligible not shard-heavy when isolated', () => {
  assert.equal(hasHeavyPipelineListFilters({ q: 'acme' }), true)
  assert.equal(isMeiliSearchOnlyFilters({ q: 'acme' }), true)
  assert.equal(isMeiliSearchOnlyFilters({ q: 'acme', tagIds: ['t1'] }), false)
})

test('tags and geo remain heavy', () => {
  assert.equal(hasHeavyPipelineListFilters({ tagIds: ['x'] }), true)
  assert.equal(hasHeavyPipelineListFilters({ city: 'Mumbai' }), true)
})
