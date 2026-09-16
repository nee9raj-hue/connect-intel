import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatLaneCadence,
  hasTradeProfileDisplayData,
  normalizeTradeProfile,
} from './leadTradeProfile.js'

describe('leadTradeProfile', () => {
  it('normalizes multi-selects, markets, and cadence', () => {
    const profile = normalizeTradeProfile({
      commodities: ['Apparel', 'apparel', 'Electronics'],
      salesChannels: ['fba', 'retail', 'b2b'],
      transportModes: ['air', 'air'],
      cargoClasses: ['commercial'],
      averageShipmentSize: '40 kg / carton',
      originFootprint: 'multi',
      splitDeliveries: 'yes',
      countries: ['USA', 'UK', 'USA'],
      shipmentFrequency: [
        { country: 'USA', perMonth: 5 },
        { country: 'UK', shipmentsPerMonth: 2 },
      ],
    })
    assert.deepEqual(profile.commodities, ['Apparel', 'Electronics'])
    assert.deepEqual(profile.salesChannels, ['fba', 'b2b'])
    assert.deepEqual(profile.transportModes, ['air'])
    assert.equal(profile.typicalShipmentSize, '40 kg / carton')
    assert.equal(profile.originFootprint, 'multi')
    assert.equal(profile.splitDeliveries, true)
    assert.deepEqual(profile.destinationMarkets, ['USA', 'UK'])
    assert.equal(formatLaneCadence(profile.laneCadence[0]), 'USA · 5 / month')
    assert.equal(hasTradeProfileDisplayData(profile), true)
  })

  it('stamps actor metadata on save without requiring filled fields', () => {
    const profile = normalizeTradeProfile({}, { actor: { userId: 'u1', name: 'Asha' } })
    assert.equal(profile.updatedByUserId, 'u1')
    assert.equal(profile.updatedByName, 'Asha')
    assert.ok(profile.updatedAt)
    assert.equal(hasTradeProfileDisplayData(profile), false)
  })
})
