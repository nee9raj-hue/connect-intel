import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dealMatchesCustomerType,
  isCrmOriginPipelineLead,
  pipelineTrackSqlAliases,
} from './crmPipelineFlow.js'
import { crmStatusMatchesFilter, crmStatusSqlAliases, isCrmLeadStatusFilter } from './crmLeadStatuses.js'

test('CRM and ERP pipeline filters stay separate', () => {
  assert.equal(isCrmLeadStatusFilter('fresh'), true)
  assert.equal(isCrmLeadStatusFilter('erp_early'), true)
  assert.ok(crmStatusSqlAliases('fresh').includes('fresh'))
  assert.ok(!crmStatusSqlAliases('fresh').includes('unqualified'))
  assert.ok(crmStatusSqlAliases('erp_early').includes('new_account'))
  assert.equal(crmStatusMatchesFilter('new_account', 'erp_early'), true)
  assert.equal(crmStatusMatchesFilter('unqualified', 'erp_early'), false)
  assert.equal(crmStatusMatchesFilter('fresh', 'fresh'), true)
})

test('pipeline track SQL aliases do not mix CRM and ERP ids', () => {
  const crm = pipelineTrackSqlAliases('crm')
  const erp = pipelineTrackSqlAliases('erp')
  assert.ok(crm.includes('fresh'))
  assert.ok(crm.includes('unqualified'))
  assert.ok(!crm.includes('new_account'))
  assert.ok(erp.includes('active_trading'))
  assert.ok(!erp.includes('unqualified'))
})

test('CRM-origin leads are the ones still on manual CRM stages', () => {
  assert.equal(isCrmOriginPipelineLead({ crm: { status: 'fresh' }, source: 'manual' }), true)
  assert.equal(isCrmOriginPipelineLead({ crm: { status: 'qualified' } }), true)
  assert.equal(
    isCrmOriginPipelineLead({ crm: { status: 'unqualified' }, source: 'erp' }),
    false
  )
  assert.equal(
    isCrmOriginPipelineLead({ crm: { status: 'unqualified', erpPipelineOwned: true } }),
    false
  )
  assert.equal(isCrmOriginPipelineLead({ crm: { status: 'new_account' } }), false)
})

test('commercial deals exclude courier customer type', () => {
  assert.equal(dealMatchesCustomerType({ customerType: 'spot_rfq' }, 'commercial'), true)
  assert.equal(dealMatchesCustomerType({ customerType: 'courier' }, 'commercial'), false)
  assert.equal(dealMatchesCustomerType({ customerType: 'courier' }, 'courier'), true)
  assert.equal(dealMatchesCustomerType({}, 'commercial'), true)
})
