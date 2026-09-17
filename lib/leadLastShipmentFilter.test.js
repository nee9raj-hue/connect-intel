import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendLastShipmentSqlParts,
  lastShipmentFilterActive,
  lastShipmentPeriodLabel,
  leadMatchesLastShipmentPeriod,
} from './leadLastShipmentFilter.js'

const septLead = {
  crm: { lastOrderCreatedAt: '2026-09-15T06:30:00.000Z' },
}
const janLead = {
  erp: { revenue: { lastShipmentDate: '2026-01-20' } },
}
const noneLead = { crm: {} }

test('last shipment year-only matches any month in that year', () => {
  const filters = { lastShipmentYear: '2026' }
  assert.equal(lastShipmentFilterActive(filters), true)
  assert.equal(leadMatchesLastShipmentPeriod(septLead, filters), true)
  assert.equal(leadMatchesLastShipmentPeriod(janLead, filters), true)
  assert.equal(leadMatchesLastShipmentPeriod(noneLead, filters), false)
  assert.equal(leadMatchesLastShipmentPeriod(septLead, { lastShipmentYear: '2025' }), false)
})

test('last shipment month filters to that calendar month', () => {
  const filters = { lastShipmentYear: '2026', lastShipmentMonth: '9' }
  assert.equal(leadMatchesLastShipmentPeriod(septLead, filters), true)
  assert.equal(leadMatchesLastShipmentPeriod(janLead, filters), false)
  assert.equal(lastShipmentPeriodLabel(filters), 'Last shipment: September 2026')
})

test('appendLastShipmentSqlParts uses lastOrderCreatedAt window', () => {
  const parts = appendLastShipmentSqlParts([], { lastShipmentYear: '2026', lastShipmentMonth: '9' })
  assert.equal(parts.length, 2)
  assert.ok(parts[0].startsWith('entry->crm->>lastOrderCreatedAt=gte.'))
  assert.ok(parts[1].startsWith('entry->crm->>lastOrderCreatedAt=lt.'))
  assert.equal(appendLastShipmentSqlParts([], {}).length, 0)
})
