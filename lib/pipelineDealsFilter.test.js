import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dealMatchesTransportMode,
  dealPeriodWindows,
  filterPipelineDealRows,
  formatDealPeriodLabel,
  isoWeeksOverlappingMonth,
  localDateRangeMs,
} from './pipelineDealsFilter.js'
import { isoWeekParts } from './calendarLocale.js'

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

  it('prefers customer booked date over CRM log time', () => {
    const rows = [
      {
        deal: {
          id: 'late-log',
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z',
          bookedOn: '2026-06-04',
          stage: 'booked',
        },
      },
    ]
    const from = new Date('2026-06-03T12:00:00.000Z')
    const to = new Date('2026-06-05T12:00:00.000Z')
    const inRange = filterPipelineDealRows(rows, {
      dateFrom: from,
      dateTo: to,
      dateStages: ['booked'],
      timeZone: TZ,
    })
    assert.equal(inRange.length, 1)
    const missed = filterPipelineDealRows(rows, {
      dateFrom: new Date('2026-08-31T12:00:00.000Z'),
      dateTo: new Date('2026-09-02T12:00:00.000Z'),
      dateStages: ['booked'],
      timeZone: TZ,
    })
    assert.equal(missed.length, 0)
  })

  it('filters by one or more deal stages', () => {
    const mixed = [
      { deal: { id: 'a', stage: 'rfq', freight: { transportMode: 'air' } } },
      { deal: { id: 'b', stage: 'quoted', freight: { transportMode: 'air' } } },
      { deal: { id: 'c', stage: 'won', freight: { transportMode: 'air' } } },
    ]
    const quotedOnly = filterPipelineDealRows(mixed, { stages: ['quoted'] })
    assert.equal(quotedOnly.length, 1)
    assert.equal(quotedOnly[0].deal.id, 'b')
    const multi = filterPipelineDealRows(mixed, { stages: ['rfq', 'won'] })
    assert.equal(multi.map((r) => r.deal.id).join(','), 'a,c')
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

describe('year month week period', () => {
  it('lists ISO weeks that overlap August 2026', () => {
    const weeks = isoWeeksOverlappingMonth(2026, 8, TZ)
    assert.ok(weeks.length >= 4)
    assert.ok(weeks.every((w) => w.label.startsWith('week')))
    const numbers = weeks.map((w) => w.week)
    assert.ok(numbers.includes(31) || numbers.includes(32))
  })

  it('ISO week 1 of 2026 contains the first Thursday', () => {
    const parts = isoWeekParts(new Date('2026-01-01T06:00:00.000Z'), TZ)
    assert.equal(parts.year, 2026)
    assert.equal(parts.week, 1)
  })

  it('filters a full year without filling other years', () => {
    const mixed = [
      { deal: { id: 'a', createdAt: '2026-03-04T10:00:00.000Z' } },
      { deal: { id: 'b', createdAt: '2025-03-04T10:00:00.000Z' } },
    ]
    const out = filterPipelineDealRows(mixed, { year: 2026, timeZone: TZ })
    assert.equal(out.map((r) => r.deal.id).join(','), 'a')
  })

  it('month filter keeps only that calendar month', () => {
    const mixed = [
      { deal: { id: 'jun', createdAt: '2026-06-04T10:00:00.000Z' } },
      { deal: { id: 'jul', createdAt: '2026-07-04T10:00:00.000Z' } },
    ]
    const out = filterPipelineDealRows(mixed, { year: 2026, month: 6, timeZone: TZ })
    assert.equal(out.map((r) => r.deal.id).join(','), 'jun')
  })

  it('selected week numbers stay disjoint', () => {
    const catalog = isoWeeksOverlappingMonth(2026, 8, TZ)
    const first = catalog[0]
    const last = catalog[catalog.length - 1]
    assert.ok(first && last && first.week !== last.week)
    const windows = dealPeriodWindows(
      { year: 2026, month: 8, weeks: [String(first.week), String(last.week)] },
      TZ
    )
    assert.equal(windows.length, 2)
    const span = windows[1].end - windows[0].start
    const union = windows.reduce((n, w) => n + (w.end - w.start), 0)
    assert.ok(span > union)
  })

  it('formats period labels like week31', () => {
    assert.equal(formatDealPeriodLabel({ year: 2026 }), '2026')
    assert.equal(formatDealPeriodLabel({ year: 2026, month: 8 }), 'August 2026')
    assert.equal(
      formatDealPeriodLabel({ year: 2026, months: [1, 9] }),
      'January, September 2026'
    )
  })
})
