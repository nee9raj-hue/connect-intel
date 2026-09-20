import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPipelineFilters } from '../frontend/src/lib/pipelineFilters.js'
import { leadMatchesCrmErpUnion } from './pipelineCrmErpUnion.js'
import { appendPipelineFilterSqlParts } from './server/pipelineFilterSql.js'

const crmFresh = { id: 'c1', crm: { status: 'fresh' } }
const crmQualified = { id: 'c2', crm: { status: 'qualified' } }
const erpActive = {
  id: 'e1',
  crm: { status: 'active_trading' },
  erpTags: [{ name: 'Active', color: '#25d366', type: 'automatic' }],
}
const erpChurn = {
  id: 'e2',
  crm: { status: 'churned' },
  erpTags: [{ name: 'Churn', color: '#ff0000', type: 'automatic' }],
}

test('CRM stages alone keep only those CRM pipeline leads', () => {
  const list = applyPipelineFilters([crmFresh, crmQualified, erpActive], {
    crmStageIds: ['fresh'],
  })
  assert.deepEqual(list.map((l) => l.id), ['c1'])
})

test('CRM stages union ERP tags so CRM leads stay in the view', () => {
  const filters = { erpTagNames: ['Active'], crmStageIds: ['fresh', 'qualified'] }
  assert.equal(leadMatchesCrmErpUnion(crmFresh, filters), true)
  assert.equal(leadMatchesCrmErpUnion(crmQualified, filters), true)
  assert.equal(leadMatchesCrmErpUnion(erpActive, filters), true)
  assert.equal(leadMatchesCrmErpUnion(erpChurn, filters), false)
  const list = applyPipelineFilters([crmFresh, crmQualified, erpActive, erpChurn], filters)
  assert.deepEqual(list.map((l) => l.id).sort(), ['c1', 'c2', 'e1'])
})

test('SQL ORs CRM stages with ERP tag filters', () => {
  const parts = appendPipelineFilterSqlParts([], {
    erpTagNames: ['Active'],
    crmStageIds: ['fresh'],
  })
  const joined = parts.join('&')
  assert.ok(joined.includes('or=('))
  assert.ok(joined.includes('fresh'))
  assert.ok(joined.includes('Active') || joined.includes('active_trading'))
})
