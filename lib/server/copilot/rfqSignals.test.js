import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  looksLikeRfqPaste,
  mapLogiCopilotJsonToFreightRfq,
  formatRfqSummary,
} from './rfqSignals.js'

describe('rfqSignals', () => {
  it('detects multi-line RFQ paste', () => {
    const text = `Need quote
50 cartons honey HSN 0409
FOB Jaipur to Los Angeles
Gross weight 600 kg
40x30x25 cm`
    assert.equal(looksLikeRfqPaste(text), true)
  })

  it('rejects short logistics questions', () => {
    assert.equal(looksLikeRfqPaste('What documents for export to USA?'), false)
  })

  it('maps LogiCopilot JSON to freight RFQ', () => {
    const freight = mapLogiCopilotJsonToFreightRfq({
      commodity: 'Honey',
      hsn_code: '0409',
      transport_mode: 'Air',
      incoterm: 'FOB',
      gross_weight_kg: 600,
      box_count: 50,
      dimensions: { length: 40, width: 30, height: 25 },
      origin_city: 'Jaipur',
      origin_pincode: '302001',
      destination_country: 'USA',
      destination_city: 'Los Angeles',
    })
    assert.ok(freight)
    assert.equal(freight.commodityType, 'Honey')
    assert.equal(freight.hsnCode, '0409')
    assert.equal(freight.transportMode, 'air')
    assert.equal(freight.incoterm, 'FOB')
    assert.equal(freight.grossWeightKg, 600)
    assert.equal(freight.pickupCity, 'Jaipur')
    assert.equal(freight.deliveryCity, 'Los Angeles')
    assert.ok(formatRfqSummary(freight).includes('Honey'))
  })
})
