import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dealMatchesTransportMode,
  filterPipelineDealRows,
  localDateRangeMs,
} from './pipelineDealsFilter.js'

const TZ = 'Asia/Kolkata'

describe('filterPipelineDealRows', () => {
  const rows = [
    {
      deal: {
        id: 'd1',
        createdAt: '2026-06-04T10:00:00.000Z',
        freight: { transportMode: 'air' },
      },
    },
    {
      deal: {
        id: 'd2',
        createdAt: '2026-06-10T10:00:00.000Z',
        freight: { transportMode: 'ocean' },
      },
    },
  ]

  it('filters by transport mode', () => {
    const airOnly = filterPipelineDealRows(rows, { transportMode: 'air' })
    assert.equal(airOnly.length, 1)
    assert.equal(airOnly[0].deal.id, 'd1')
  })

  it('filters by inclusive date range', () => {
    const from = new Date('2026-06-03T12:00:00.000Z')
    const to = new Date('2026-06-05T12:00:00.000Z')
    const inRange = filterPipelineDealRows(rows, { dateFrom: from, dateTo: to, timeZone: TZ })
    assert.equal(inRange.length, 1)
    assert.equal(inRange[0].deal.id, 'd1')
  })

  it('filters from date only', () => {
    const from = new Date('2026-06-10T12:00:00.000Z')
    const out = filterPipelineDealRows(rows, { dateFrom: from, timeZone: TZ })
    assert.equal(out.length, 1)
    assert.equal(out[0].deal.id, 'd2')
  })
})

describe('localDateRangeMs', () => {
  it('swaps reversed from/to', () => {
    const from = new Date('2026-06-10T12:00:00.000Z')
    const to = new Date('2026-06-01T12:00:00.000Z')
    const { start, end } = localDateRangeMs(from, to, TZ)
    assert.ok(start < end)
  })
})

describe('dealMatchesTransportMode', () => {
  it('matches air_ocean for air and ocean filters', () => {
    const freight = { transportMode: 'air_ocean' }
    assert.equal(dealMatchesTransportMode(freight, 'air'), true)
    assert.equal(dealMatchesTransportMode(freight, 'ocean'), true)
  })
})
