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
