import test from 'node:test'
import assert from 'node:assert/strict'
import {
  companiesMatchForDealRelink,
  normalizeDealCompanyKey,
  selectOrphanDealsForLead,
} from './relinkOrphanDeals.js'

test('company keys ignore legal suffixes', () => {
  assert.equal(
    normalizeDealCompanyKey('ZENITH DRINKS PRIVATE LIMITED'),
    normalizeDealCompanyKey('Zenith Drinks Pvt Ltd'),
  )
  assert.equal(companiesMatchForDealRelink('Zenith Drinks', 'ZENITH DRINKS PRIVATE LIMITED'), true)
  assert.equal(companiesMatchForDealRelink('Acme', 'Other Co'), false)
})

test('selectOrphanDealsForLead attaches leftover company deals', () => {
  const entry = {
    lead: { id: 'new-1', company: 'Zenith Drinks Pvt Ltd' },
    crm: { deals: [] },
  }
  const rows = [
    {
      lead_id: 'deleted-lead',
      deal_id: 'd1',
      payload: { company: 'ZENITH DRINKS PRIVATE LIMITED', deal: { id: 'd1', name: 'Air RFQ', stage: 'quoted' } },
    },
    {
      lead_id: 'live-other',
      deal_id: 'd2',
      payload: { company: 'Zenith Drinks Pvt Ltd', deal: { id: 'd2', name: 'Keep', stage: 'won' } },
    },
  ]
  const live = new Set(['live-other'])
  const attached = selectOrphanDealsForLead(rows, entry, live)
  assert.deepEqual(attached.map((d) => d.id), ['d1'])
})
