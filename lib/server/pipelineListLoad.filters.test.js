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

test('city, state, and lead score are not heavy (SQL denorm path)', () => {
  assert.equal(hasHeavyPipelineListFilters({ city: 'Mumbai' }), false)
  assert.equal(hasHeavyPipelineListFilters({ state: 'MH' }), false)
  assert.equal(hasHeavyPipelineListFilters({ minLeadScore: 50 }), false)
})

test('tags and stuck remain heavy', () => {
  assert.equal(hasHeavyPipelineListFilters({ tagIds: ['x'] }), true)
  assert.equal(hasHeavyPipelineListFilters({ stuck: true }), true)
})
