import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compactDealClipMeta,
  dealIsInClipWindow,
  slimPipelineDealsForList,
} from './pipelineDealClips.js'

test('pipeline clips keep only deals from the last 30 days', () => {
  const now = Date.parse('2026-09-21T06:30:00.000Z')
  const deals = [
    { id: 'new', name: '21-09-2026 Acme 001', createdAt: '2026-09-10T00:00:00.000Z', stage: 'quoted', amount: 120 },
    { id: 'old', name: 'Old deal', createdAt: '2026-01-01T00:00:00.000Z', stage: 'won', amount: 9 },
  ]
  const clips = slimPipelineDealsForList(deals, now)
  assert.deepEqual(clips.map((d) => d.id), ['new'])
  assert.equal(dealIsInClipWindow(deals[1], now), false)
})

test('pipeline clip meta includes heading details in one compact line', () => {
  const line = compactDealClipMeta(
    {
      name: '21-09-2026 Acme 001',
      stage: 'quoted',
      bookedOn: '2026-09-18',
      freight: { pickupCity: 'Mumbai', deliveryCity: 'Dubai', transportMode: 'air', incoterm: 'FOB' },
    },
    { stageLabel: 'Quoted', amountLabel: '₹120' }
  )
  assert.match(line, /Quoted/)
  assert.match(line, /₹120/)
  assert.match(line, /Mumbai → Dubai/)
  assert.match(line, /FOB/)
})
