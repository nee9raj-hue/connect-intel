import test from 'node:test'
import assert from 'node:assert/strict'
import {
  leadHasCustomerNotes,
  leadMatchesNotesPresence,
  leadMatchesStatusIds,
  notesPresenceSqlParts,
  normalizeNotesPresence,
} from './pipelineColumnFilters.js'
import { lastShipmentPeriodTokens, leadMatchesLastShipmentPeriod } from './leadLastShipmentFilter.js'
import { applyPipelineFilters } from '../frontend/src/lib/pipelineFilters.js'

test('notes presence treats whitespace as blank', () => {
  assert.equal(leadHasCustomerNotes({ crm: { notes: '  ' } }), false)
  assert.equal(leadHasCustomerNotes({ crm: { notes: 'Need rates' } }), true)
  assert.equal(normalizeNotesPresence({ notesPresence: ['has', 'blank'] }), '')
  assert.equal(normalizeNotesPresence({ notesPresence: ['has'] }), 'has')
  assert.equal(leadMatchesNotesPresence({ crm: { notes: '' } }, { notesPresence: ['blank'] }), true)
  assert.equal(leadMatchesNotesPresence({ crm: { notes: 'Hi' } }, { notesPresence: ['blank'] }), false)
  assert.ok(notesPresenceSqlParts({ notesPresence: ['has'] })[0].startsWith('not.or='))
})

test('status column multi-select matches CRM or ERP aliases', () => {
  assert.equal(leadMatchesStatusIds({ crm: { status: 'fresh' } }, ['fresh', 'erp_active']), true)
  assert.equal(leadMatchesStatusIds({ crm: { status: 'active_trading' } }, ['erp_active']), true)
  assert.equal(leadMatchesStatusIds({ crm: { status: 'churned' } }, ['fresh']), false)
})

test('last shipment header periods can span years', () => {
  const filters = { lastShipmentPeriods: ['2026-9', '2025-1'] }
  assert.deepEqual(lastShipmentPeriodTokens(filters), ['2026-9', '2025-1'])
  assert.equal(
    leadMatchesLastShipmentPeriod({ crm: { lastOrderCreatedAt: '2026-09-15T06:30:00.000Z' } }, filters),
    true
  )
  assert.equal(
    leadMatchesLastShipmentPeriod({ crm: { lastOrderCreatedAt: '2026-02-10T06:30:00.000Z' } }, filters),
    false
  )
})

test('empty column filters keep CRM vs ERP track matching', () => {
  const leads = [
    { id: 'crm', crm: { status: 'fresh' } },
    { id: 'erp', crm: { status: 'active_trading' } },
  ]
  assert.deepEqual(
    applyPipelineFilters(leads, { pipelineTrack: 'crm' }).map((l) => l.id),
    ['crm']
  )
  assert.deepEqual(
    applyPipelineFilters(leads, {
      pipelineTrack: 'erp',
      statusIds: [],
      notesPresence: [],
      lastShipmentPeriods: [],
    }).map((l) => l.id),
    ['erp']
  )
})

test('pipeline list applies header status, tags, notes, and shipment together', () => {
  const leads = [
    { id: 'a', crm: { status: 'fresh', notes: 'Call back', tagIds: ['t1'] } },
    { id: 'b', crm: { status: 'fresh', notes: '', tagIds: [] } },
    { id: 'c', crm: { status: 'qualified', notes: 'x', tagIds: ['t1'] } },
  ]
  const list = applyPipelineFilters(leads, {
    statusIds: ['fresh'],
    notesPresence: ['has'],
    tagIds: ['t1'],
  })
  assert.deepEqual(list.map((l) => l.id), ['a'])
})
