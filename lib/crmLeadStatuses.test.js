import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CRM_STATUS_IDS,
  LEGACY_CRM_STATUS_MAP,
  crmStatusMatchesFilter,
  crmStatusSqlAliases,
  foldCrmStatusCounts,
  migrateOrgPipelineStages,
  normalizeCrmLeadStatus,
  suggestCrmStatusFromTradingProfile,
} from './crmLeadStatuses.js'

test('legacy CRM statuses map onto account stages', () => {
  assert.equal(normalizeCrmLeadStatus('new'), 'unqualified')
  assert.equal(normalizeCrmLeadStatus('contacted'), 'qualified')
  assert.equal(normalizeCrmLeadStatus('follow_up'), 'opportunity')
  assert.equal(normalizeCrmLeadStatus('replied'), 'opportunity')
  assert.equal(normalizeCrmLeadStatus('won'), 'onboarding')
  assert.equal(normalizeCrmLeadStatus('active_trading'), 'active_trading')
  assert.equal(normalizeCrmLeadStatus('lost'), 'lost')
})

test('SQL aliases include stored legacy ids', () => {
  assert.deepEqual(crmStatusSqlAliases('opportunity').sort(), ['follow_up', 'opportunity', 'replied'].sort())
  assert.ok(crmStatusSqlAliases('unqualified').includes('new'))
})

test('filter match folds legacy rows', () => {
  assert.equal(crmStatusMatchesFilter('replied', 'opportunity'), true)
  assert.equal(crmStatusMatchesFilter('won', 'onboarding'), true)
  assert.equal(crmStatusMatchesFilter('lost', 'churned'), false)
})

test('counts fold legacy into canonical stages', () => {
  const folded = foldCrmStatusCounts([
    { status: 'new', count: 2 },
    { status: 'unqualified', count: 1 },
    { status: 'replied', count: 4 },
  ])
  const byId = Object.fromEntries(folded.map((row) => [row.status, row.count]))
  assert.equal(byId.unqualified, 3)
  assert.equal(byId.opportunity, 4)
  assert.equal(CRM_STATUS_IDS.length, 8)
  assert.ok(!Object.keys(LEGACY_CRM_STATUS_MAP).includes('lost'))
})

test('legacy default pipelines are replaced', () => {
  const migrated = migrateOrgPipelineStages([
    { id: 'new', label: 'New', color: 'slate' },
    { id: 'follow_up', label: 'Follow up', color: 'amber' },
    { id: 'replied', label: 'Replied', color: 'blue' },
    { id: 'won', label: 'Won', color: 'emerald' },
    { id: 'lost', label: 'Lost', color: 'gray' },
  ])
  assert.equal(migrated[0].id, 'unqualified')
  assert.ok(!migrated.some((s) => s.id === 'follow_up' || s.id === 'replied' || s.id === 'won'))
})

test('trading profile suggests churned / at risk / active trader', () => {
  const now = Date.parse('2026-09-16T00:00:00Z')
  assert.equal(
    suggestCrmStatusFromTradingProfile(
      { lastShipmentAt: '2026-05-01T00:00:00Z', shipmentCount: 8 },
      'active_trading',
      now,
    ),
    'churned',
  )
  const shipments = [
    { date: '2026-05-20T00:00:00Z' },
    { date: '2026-05-25T00:00:00Z' },
    { date: '2026-06-01T00:00:00Z' },
    { date: '2026-08-20T00:00:00Z' },
  ]
  assert.equal(
    suggestCrmStatusFromTradingProfile({ shipments, lastShipmentAt: '2026-08-20T00:00:00Z', shipmentCount: 4 }, 'active_trading', now),
    'at_risk',
  )
  assert.equal(
    suggestCrmStatusFromTradingProfile(
      { lastShipmentAt: '2026-09-01T00:00:00Z', shipmentCount: 3, shipments: [{ date: '2026-09-01T00:00:00Z' }] },
      'onboarding',
      now,
    ),
    'active_trading',
  )
  assert.equal(
    suggestCrmStatusFromTradingProfile({ lastShipmentAt: '2026-09-01T00:00:00Z', shipmentCount: 2 }, 'lost', now),
    null,
  )
})
