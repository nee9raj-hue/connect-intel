import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dealExportCell, dealsToCsv, DEFAULT_DEAL_EXPORT_COLUMNS } from './dealExport.js'

describe('dealExport', () => {
  const sampleRow = {
    leadId: 'lead-1',
    leadName: 'Acme Corp',
    company: 'Acme Corp',
    deal: {
      id: 'deal-1',
      name: 'Mumbai → USA air',
      stage: 'quoted',
      amount: 125000,
      currency: 'INR',
      updatedAt: '2025-07-01T10:00:00.000Z',
      freight: {
        customerType: 'spot_rfq',
        transportMode: 'air',
        pickupCity: 'Mumbai',
        deliveryCity: 'New York',
        grossWeightKg: 450,
        invoiceAmount: 130000,
      },
    },
  }

  it('maps deal row cells', () => {
    assert.equal(dealExportCell(sampleRow, 'dealName'), 'Mumbai → USA air')
    assert.equal(dealExportCell(sampleRow, 'stage'), 'Quoted')
    assert.equal(dealExportCell(sampleRow, 'transportMode'), 'Air')
    assert.equal(dealExportCell(sampleRow, 'route'), 'Mumbai → New York')
    assert.equal(dealExportCell(sampleRow, 'grossWeight'), '450 kg')
  })

  it('builds CSV with headers', () => {
    const csv = dealsToCsv([sampleRow], ['dealName', 'stage', 'leadId'])
    const lines = csv.split('\n')
    assert.equal(lines[0], 'Deal,Stage,Lead ID')
    assert.ok(lines[1].includes('Mumbai → USA air'))
    assert.ok(lines[1].includes('lead-1'))
  })

  it('defaults to standard columns', () => {
    const csv = dealsToCsv([sampleRow])
    const header = csv.split('\n')[0]
    for (const col of DEFAULT_DEAL_EXPORT_COLUMNS.slice(0, 3)) {
      assert.ok(header.length > 0)
      void col
    }
    assert.ok(header.includes('Deal'))
    assert.ok(header.includes('Lead'))
  })
})
