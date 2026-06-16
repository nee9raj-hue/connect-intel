import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mapCrmActivityToTimelineItem,
  mergeTimelineItems,
} from './teamActivityTimeline.js'

describe('mapCrmActivityToTimelineItem', () => {
  it('maps pipeline activity rows to feed items', () => {
    const item = mapCrmActivityToTimelineItem({
      id: 'a1',
      type: 'call',
      summary: 'Discussed RFQ',
      createdAt: '2026-06-04T10:00:00.000Z',
      createdByUserId: 'rep1',
      createdByName: 'Neeraj',
      leadId: 'l1',
      leadName: 'Acme Exports',
      company: 'Acme Exports',
    })
    assert.equal(item.kind, 'activity')
    assert.equal(item.type, 'call')
    assert.equal(item.actorUserId, 'rep1')
    assert.equal(item.body, 'Discussed RFQ')
  })
})

describe('mergeTimelineItems', () => {
  it('merges deals with table activities and sorts by time desc', () => {
    const merged = mergeTimelineItems(
      [
        {
          id: 'act-1',
          kind: 'activity',
          type: 'call',
          at: '2026-06-04T10:00:00.000Z',
        },
      ],
      [
        {
          id: 'deal-1',
          kind: 'deal',
          type: 'deal_created',
          at: '2026-06-04T11:00:00.000Z',
        },
      ],
      10
    )
    assert.equal(merged.length, 2)
    assert.equal(merged[0].id, 'deal-1')
    assert.equal(merged[1].id, 'act-1')
  })
})
