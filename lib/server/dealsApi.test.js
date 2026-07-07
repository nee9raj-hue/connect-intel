import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('dealsApi mapDealRecord shape', () => {
  it('exports deal API helpers', async () => {
    const mod = await import('./dealsApi.js')
    assert.equal(typeof mod.getCrmDeal, 'function')
    assert.equal(typeof mod.listCrmDeals, 'function')
    assert.equal(typeof mod.patchCrmDeal, 'function')
  })
})
