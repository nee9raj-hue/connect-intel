import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyDealMilestonePatch,
  formatDealCalendarDate,
  normalizeDealCalendarDate,
  pickDealMilestones,
} from './dealMilestones.js'

describe('deal calendar dates', () => {
  it('normalizes ISO dates and strips time', () => {
    assert.equal(normalizeDealCalendarDate('2026-04-09'), '2026-04-09')
    assert.equal(normalizeDealCalendarDate('2026-04-09T18:22:00.000Z'), '2026-04-09')
    assert.equal(normalizeDealCalendarDate(''), null)
    assert.equal(normalizeDealCalendarDate('not-a-date'), null)
  })

  it('does not invent dates from missing fields', () => {
    const picked = pickDealMilestones({ stage: 'won', createdAt: '2026-09-15T10:00:00.000Z' })
    assert.equal(picked.queryReceivedOn, null)
    assert.equal(picked.wonOn, null)
  })

  it('applies only patched milestone fields', () => {
    const deal = pickDealMilestones({ queryReceivedOn: '2026-01-02', ratesQuotedOn: '2026-01-05' })
    applyDealMilestonePatch(deal, { ratesQuotedOn: '2026-01-08', wonOn: '2026-01-20' })
    assert.equal(deal.queryReceivedOn, '2026-01-02')
    assert.equal(deal.ratesQuotedOn, '2026-01-08')
    assert.equal(deal.wonOn, '2026-01-20')
  })

  it('formats dates for Indian display', () => {
    assert.equal(formatDealCalendarDate('2026-04-09'), '09-04-2026')
  })
})

describe('deal customer dates in workflow', () => {
  it('stores RFQ and quote dates separately from CRM log time', async () => {
    const { addDeal, updateDeal } = await import('./server/crmWorkflow.js')
    const { crm, deal } = addDeal(
      {},
      {
        name: 'Ocean RFQ',
        queryReceivedOn: '2026-03-01',
        ratesQuotedOn: '2026-03-04',
      },
      { userId: 'u1', name: 'Rep' }
    )
    assert.equal(deal.queryReceivedOn, '2026-03-01')
    assert.equal(deal.ratesQuotedOn, '2026-03-04')
    assert.equal(deal.wonOn, null)
    assert.match(deal.createdAt, /T/)

    const next = updateDeal(crm, deal.id, { bookedOn: '2026-03-12', wonOn: '2026-03-15' }, {
      userId: 'u1',
      name: 'Rep',
    })
    const updated = next.deals.find((row) => row.id === deal.id)
    assert.equal(updated.queryReceivedOn, '2026-03-01')
    assert.equal(updated.bookedOn, '2026-03-12')
    assert.equal(updated.wonOn, '2026-03-15')
  })
})
