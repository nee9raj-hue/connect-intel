import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dealMatchesTransportMode,
  dealRowInWeek,
  filterPipelineDealRows,
  localWeekRangeMs,
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

  it('filters by week anchor date', () => {
    const anchor = new Date('2026-06-04T12:00:00.000Z')
    const inWeek = filterPipelineDealRows(rows, { weekAnchorDate: anchor, timeZone: TZ })
    assert.equal(inWeek.length, 1)
    assert.equal(inWeek[0].deal.id, 'd1')
  })
})

describe('dealMatchesTransportMode', () => {
  it('matches air_ocean for air and ocean filters', () => {
    const freight = { transportMode: 'air_ocean' }
    assert.equal(dealMatchesTransportMode(freight, 'air'), true)
    assert.equal(dealMatchesTransportMode(freight, 'ocean'), true)
  })
})
