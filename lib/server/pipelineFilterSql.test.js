import test from 'node:test'
import assert from 'node:assert/strict'
import { appendPipelineFilterSqlParts } from './pipelineFilterSql.js'

test('appendPipelineFilterSqlParts builds city and score filters', () => {
  const parts = appendPipelineFilterSqlParts(['shard_name=eq.org1'], {
    city: 'Mumbai',
    minLeadScore: 40,
    maxLeadScore: 90,
    hasDeals: true,
  })
  assert.ok(parts.some((p) => p.startsWith('city=eq.')))
  assert.ok(parts.some((p) => p.startsWith('lead_score=gte.')))
  assert.ok(parts.some((p) => p.startsWith('lead_score=lte.')))
  assert.ok(parts.includes('deal_count=gt.0'))
})

test('appendPipelineFilterSqlParts supports multiple cities with or', () => {
  const parts = appendPipelineFilterSqlParts([], { cities: ['Mumbai', 'Pune'] })
  assert.equal(parts.length, 1)
  assert.ok(parts[0].startsWith('or=('))
  assert.ok(parts[0].includes('city.eq.Mumbai'))
})
