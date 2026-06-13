import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCampaignEngagementFromEvents,
  finalizeCampaignEngagementStats,
  rollupEngagementFromEvents,
} from './marketingAnalytics.js'

test('rollupEngagementFromEvents counts unique opens per campaign', () => {
  const events = [
    { campaignId: 'c1', leadId: 'l1', type: 'open' },
    { campaignId: 'c1', leadId: 'l1', type: 'open' },
    { campaignId: 'c1', leadId: 'l2', type: 'open' },
    { campaignId: 'c1', leadId: 'l2', type: 'click' },
  ]
  const rollups = rollupEngagementFromEvents(events)
  assert.equal(rollups.get('c1').uniqueOpens, 2)
  assert.equal(rollups.get('c1').opens, 3)
  assert.equal(rollups.get('c1').uniqueClicks, 1)
})

test('buildCampaignEngagementFromEvents overrides stale zero rates from events', () => {
  const campaign = {
    id: 'c1',
    stats: { sent: 100, openRate: 0, uniqueOpens: 0, clickRate: 0, uniqueClicks: 0 },
  }
  const events = [
    { campaignId: 'c1', leadId: 'l1', type: 'open' },
    { campaignId: 'c1', leadId: 'l2', type: 'open' },
    { campaignId: 'c1', leadId: 'l2', type: 'click' },
  ]
  const engagement = buildCampaignEngagementFromEvents(campaign, events)
  assert.equal(engagement.uniqueOpens, 2)
  assert.equal(engagement.openRate, 2)
  assert.equal(engagement.uniqueClicks, 1)
  assert.equal(engagement.clickRate, 1)
})

test('finalizeCampaignEngagementStats recalculates when unique opens exist', () => {
  const stats = finalizeCampaignEngagementStats({
    sent: 50,
    uniqueOpens: 10,
    openRate: 0,
  })
  assert.equal(stats.openRate, 20)
})
