import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildProgressFromSqlAggregate } from './email/campaignProgress.js'

describe('buildProgressFromSqlAggregate', () => {
  it('maps campaign_stats rows to progress snapshot', () => {
    const progress = buildProgressFromSqlAggregate('camp-1', {
      stats: {
        queued: 12,
        sending: 2,
        sent: 40,
        failed: 1,
        unsubscribed: 0,
        opened: 8,
        clicked: 3,
        updated_at: '2026-06-01T12:00:00.000Z',
      },
      campaign: { send_status: 'sending', status: 'active', provider: 'resend' },
      dueCount: 2,
      activeCount: 14,
    })

    assert.equal(progress.source, 'campaign_stats')
    assert.equal(progress.campaignId, 'camp-1')
    assert.equal(progress.sendStatus, 'sending')
    assert.equal(progress.sent, 40)
    assert.equal(progress.failed, 1)
    assert.equal(progress.pendingSends, 2)
    assert.equal(progress.queuedSends, 14)
    assert.equal(progress.remaining, 14)
    assert.equal(progress.done, false)
    assert.equal(progress.opened, 8)
    assert.equal(progress.clicked, 3)
  })

  it('marks completed when queue is empty and all recipients processed', () => {
    const progress = buildProgressFromSqlAggregate('camp-2', {
      stats: { queued: 0, sending: 0, sent: 50, failed: 0, unsubscribed: 0 },
      campaign: { send_status: 'completed', status: 'completed' },
      dueCount: 0,
      activeCount: 0,
    })

    assert.equal(progress.sendStatus, 'completed')
    assert.equal(progress.done, true)
    assert.equal(progress.remaining, 0)
  })
})
