import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toPipelineDealListRow } from './dealsApi.js'

describe('dealsApi', () => {
  it('exports deal API helpers', async () => {
    const mod = await import('./dealsApi.js')
    assert.equal(typeof mod.getCrmDeal, 'function')
    assert.equal(typeof mod.listCrmDeals, 'function')
    assert.equal(typeof mod.createCrmDeal, 'function')
    assert.equal(typeof mod.patchCrmDeal, 'function')
    assert.equal(typeof mod.deleteCrmDeal, 'function')
    assert.equal(typeof mod.duplicateCrmDeal, 'function')
    assert.equal(typeof mod.toPipelineDealListRow, 'function')
  })

  it('toPipelineDealListRow maps pipeline table shape', () => {
    const row = toPipelineDealListRow({
      leadId: 'lead_1',
      leadName: 'Acme Corp',
      company: 'Acme Corp',
      assigneeUserId: 'user_1',
      updatedAt: '2026-07-09T10:00:00.000Z',
      deal: {
        id: 'deal_1',
        name: 'Freight RFQ',
        stage: 'rfq',
        amount: 120000,
        updatedAt: '2026-07-09T10:00:00.000Z',
      },
    })
    assert.equal(row.leadId, 'lead_1')
    assert.equal(row.deal.id, 'deal_1')
    assert.equal(row.assigneeUserId, 'user_1')
    assert.equal(row.savedAt, '2026-07-09T10:00:00.000Z')
  })
})
