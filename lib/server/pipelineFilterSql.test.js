import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendPipelineFilterSqlParts,
  filtersUseEntryLocationFilter,
  stripLocationSqlFilters,
} from './pipelineFilterSql.js'

test('appendPipelineFilterSqlParts builds score and deal filters', () => {
  const parts = appendPipelineFilterSqlParts(['shard_name=eq.org1'], {
    city: 'Mumbai',
    minLeadScore: 40,
    maxLeadScore: 90,
    hasDeals: true,
  })
  assert.ok(!parts.some((p) => p.startsWith('city=eq.')))
  assert.ok(parts.some((p) => p.startsWith('lead_score=gte.')))
  assert.ok(parts.some((p) => p.startsWith('lead_score=lte.')))
  assert.ok(parts.includes('deal_count=gt.0'))
})

test('city and state filters use entry JSON path, not SQL columns', () => {
  const parts = appendPipelineFilterSqlParts([], { cities: ['Mumbai', 'Pune'], states: ['Delhi'] })
  assert.equal(parts.length, 0)
  assert.equal(filtersUseEntryLocationFilter({ states: ['Delhi'] }), true)
  assert.deepEqual(stripLocationSqlFilters({ states: ['Delhi'], status: 'follow_up' }).states, [])
})
