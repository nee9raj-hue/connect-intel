import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  boxVolumetricWeightKg,
  boxCbm,
  freightChargeableMeasure,
  totalCbm,
  totalVolumetricWeightKg,
} from './freightDeal.js'

describe('freight volumetric weight', () => {
  it('calculates single box with divisor 5000', () => {
    const kg = boxVolumetricWeightKg({ lengthCm: 50, widthCm: 40, heightCm: 30, quantity: 1 }, 5000)
    assert.equal(kg, 12)
  })

  it('calculates with divisor 6000', () => {
    const kg = boxVolumetricWeightKg({ lengthCm: 60, widthCm: 40, heightCm: 30, quantity: 2 }, 6000)
    assert.equal(kg, 24)
  })

  it('sums multiple box lines', () => {
    const total = totalVolumetricWeightKg(
      [
        { lengthCm: 50, widthCm: 40, heightCm: 30, quantity: 1 },
        { lengthCm: 10, widthCm: 10, heightCm: 10, quantity: 5 },
      ],
      5000
    )
    assert.equal(total, 13)
  })

  it('chargeable weight is max of gross and volumetric', () => {
    const result = freightChargeableMeasure({
      transportMode: 'air',
      grossWeightKg: 8,
      boxes: [{ lengthCm: 50, widthCm: 40, heightCm: 30, quantity: 1 }],
      volumetricDivisor: 5000,
    })
    assert.equal(result.dimensionalValue, 12)
    assert.equal(result.chargeableValue, 12)
  })

  it('ocean mode uses CBM from cm dimensions', () => {
    const cbm = boxCbm({ lengthCm: 100, widthCm: 100, heightCm: 100, quantity: 1 })
    assert.equal(cbm, 1)
    const result = freightChargeableMeasure({
      transportMode: 'ocean',
      grossWeightKg: 0.8,
      boxes: [{ lengthCm: 100, widthCm: 100, heightCm: 100, quantity: 1 }],
    })
    assert.equal(result.unit, 'cbm')
    assert.equal(result.dimensionalValue, 1)
    assert.equal(result.chargeableValue, 1)
  })

  it('sums CBM across box lines', () => {
    assert.equal(
      totalCbm([
        { lengthCm: 100, widthCm: 100, heightCm: 50, quantity: 2 },
        { lengthCm: 50, widthCm: 50, heightCm: 50, quantity: 1 },
      ]),
      1.125
    )
  })
})
