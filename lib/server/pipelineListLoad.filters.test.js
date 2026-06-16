import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasHeavyPipelineListFilters,
  isMeiliSearchOnlyFilters,
  mergePipelineQueryOptions,
} from './pipelineListLoad.js'

test('follow-up filters are not heavy (SQL path eligible)', () => {
  assert.equal(hasHeavyPipelineListFilters({ followUpDue: true }), false)
  assert.equal(hasHeavyPipelineListFilters({ overdueFollowUp: true }), false)
})

test('text search alone is Meili-eligible not shard-heavy when isolated', () => {
  assert.equal(hasHeavyPipelineListFilters({ q: 'acme' }), true)
  assert.equal(isMeiliSearchOnlyFilters({ q: 'acme' }), true)
  assert.equal(isMeiliSearchOnlyFilters({ q: 'acme', tagIds: ['t1'] }), true)
})

test('city, state, and lead score are not heavy (SQL denorm path)', () => {
  assert.equal(hasHeavyPipelineListFilters({ city: 'Mumbai' }), false)
  assert.equal(hasHeavyPipelineListFilters({ state: 'MH' }), false)
  assert.equal(hasHeavyPipelineListFilters({ minLeadScore: 50 }), false)
})

test('tags are not heavy (SQL jsonb path eligible)', () => {
  assert.equal(hasHeavyPipelineListFilters({ tagIds: ['x'] }), false)
})

test('tags and stuck remain heavy', () => {
  assert.equal(hasHeavyPipelineListFilters({ tagIds: ['x'], q: 'acme' }), true)
  assert.equal(hasHeavyPipelineListFilters({ stuck: true }), true)
})

test('mergePipelineQueryOptions keeps per-column status over global all', () => {
  const opts = mergePipelineQueryOptions(
    { status: 'all', assigneeUserId: 'u1' },
    { status: 'won', offset: 0, limit: 50 }
  )
  assert.equal(opts.status, 'won')
  assert.equal(opts.assigneeUserId, 'u1')
  assert.equal(opts.limit, 50)
})
