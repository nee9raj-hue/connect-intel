import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { convertUsdToInr, FALLBACK_USD_INR } from './usdInr.js'

describe('convertUsdToInr', () => {
  it('converts quote USD to INR', () => {
    assert.equal(convertUsdToInr(200, 88), 17600)
    assert.equal(convertUsdToInr(10.5, 88), 924)
  })

  it('rejects invalid rates', () => {
    assert.equal(convertUsdToInr(100, 0), null)
    assert.equal(convertUsdToInr(100, NaN), null)
  })

  it('keeps a sane fallback for ocean revenue if the feed is down', () => {
    assert.ok(FALLBACK_USD_INR > 50 && FALLBACK_USD_INR < 150)
  })
})
