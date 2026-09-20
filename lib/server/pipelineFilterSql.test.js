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

test('appendPipelineFilterSqlParts builds last shipment date window', () => {
  const parts = appendPipelineFilterSqlParts([], {
    lastShipmentYear: '2026',
    lastShipmentMonth: '9',
  })
  assert.ok(parts.some((p) => p.startsWith('entry->crm->>lastOrderCreatedAt=gte.')))
  assert.ok(parts.some((p) => p.startsWith('entry->crm->>lastOrderCreatedAt=lt.')))
})

test('appendPipelineFilterSqlParts ORs disjoint last shipment months', () => {
  const parts = appendPipelineFilterSqlParts([], {
    lastShipmentYear: '2026',
    lastShipmentMonths: [1, 9],
  })
  assert.equal(parts.filter((p) => p.startsWith('or=(')).length, 1)
  assert.ok(parts.some((p) => p.includes('and(')))
})

test('appendPipelineFilterSqlParts filters ERP tags without CRM tagIds', () => {
  const parts = appendPipelineFilterSqlParts([], { erpTagNames: ['Churn'] })
  assert.ok(parts.some((p) => p.includes('erp_tags') || p.includes('revenue->tags')))
  assert.ok(parts.some((p) => p.includes('Churn')))
  assert.ok(parts.some((p) => p.includes('churned') && p.includes('entry->crm->>status')))
  assert.ok(!parts.some((p) => p.includes('tagIds')))
})

test('city and state filters use entry JSON path, not SQL columns', () => {
  const parts = appendPipelineFilterSqlParts([], { cities: ['Mumbai', 'Pune'], states: ['Delhi'] })
  assert.equal(parts.length, 0)
  assert.equal(filtersUseEntryLocationFilter({ states: ['Delhi'] }), true)
  assert.deepEqual(stripLocationSqlFilters({ states: ['Delhi'], status: 'follow_up' }).states, [])
})
