import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  explicitImportLeadStatus,
  mergeImportedCrmOntoExisting,
  mergeImportedLeadOntoExisting,
} from './pipelineImportMerge.js'

describe('pipelineImportMerge', () => {
  it('does not invent a lead status from a blank ERP row', () => {
    assert.equal(explicitImportLeadStatus({ company: 'Acme' }), null)
    assert.equal(explicitImportLeadStatus({ status: 'qualified' }), 'qualified')
  })

  it('keeps CRM names when ERP cells are empty', () => {
    const merged = mergeImportedLeadOntoExisting(
      { firstName: 'Priya', phone: '999', city: 'Mumbai' },
      { firstName: '', phone: '888', city: '', company: 'Acme' }
    )
    assert.equal(merged.firstName, 'Priya')
    assert.equal(merged.phone, '888')
    assert.equal(merged.city, 'Mumbai')
    assert.equal(merged.company, 'Acme')
  })

  it('overlays ERP revenue fields without wiping CRM identity', () => {
    const merged = mergeImportedLeadOntoExisting(
      { firstName: 'Priya', erp: { revenue: { revenue: 10 } } },
      { firstName: '', revenue: 250000, last_shipment_date: '2026-08-01' }
    )
    assert.equal(merged.firstName, 'Priya')
    assert.equal(merged.erp.revenue.revenue, 250000)
    assert.equal(merged.erp.revenue.lastShipmentDate, '2026-08-01')
  })

  it('keeps CRM deals when re-importing a customer', () => {
    const deals = [{ id: 'd1', name: 'Air RFQ', stage: 'quoted' }]
    const next = mergeImportedCrmOntoExisting(
      {
        status: 'opportunity',
        deals,
        activities: [{ id: 'a1' }],
        notes: 'Rep notes',
      },
      { status: null, notes: null, tagIds: ['t1'] }
    )
    assert.equal(next.status, 'opportunity')
    assert.equal(next.notes, 'Rep notes')
    assert.equal(next.deals[0].id, 'd1')
    assert.equal(next.activities[0].id, 'a1')
    assert.deepEqual(next.tagIds, ['t1'])
  })
})
