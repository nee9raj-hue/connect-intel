import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCrmPayload,
  lastOrderCreatedAtFromErp,
  laterIsoTimestamp,
  resolveLeadLastOrderCreatedAt,
  stampLastOrderCreatedAt,
  toIsoTimestamp,
} from './leadLastOrder.js'
import { buildEnterpriseLeadRow } from './server/enterpriseLeadsTable.js'

describe('leadLastOrder', () => {
  it('converts a date-only last transacted value to an ISO timestamp', () => {
    assert.equal(toIsoTimestamp('2026-06-29'), '2026-06-29T00:00:00.000Z')
    assert.equal(lastOrderCreatedAtFromErp({
      revenue: { lastTransactedDate: '2026-06-29', lastShipmentDate: '2026-06-01' },
    }), '2026-06-29T00:00:00.000Z')
  })

  it('keeps the later timestamp when a newer transaction arrives', () => {
    assert.equal(
      laterIsoTimestamp('2026-01-01T00:00:00.000Z', '2026-06-29T00:00:00.000Z'),
      '2026-06-29T00:00:00.000Z'
    )
    const entry = {
      crm: { lastOrderCreatedAt: '2026-01-01T00:00:00.000Z', tagIds: ['t1'] },
    }
    stampLastOrderCreatedAt(entry, '2026-06-29')
    assert.equal(entry.crm.lastOrderCreatedAt, '2026-06-29T00:00:00.000Z')
    assert.deepEqual(entry.crm.tagIds, ['t1'])
  })

  it('preserves existing crm_payload keys when writing lastOrderCreatedAt', () => {
    const payload = buildCrmPayload({
      crm: {
        tagIds: ['a'],
        nextFollowUpAt: '2026-09-20T00:00:00.000Z',
        deals: [{ id: 'd1' }],
        notes: 'secret',
        lastOrderCreatedAt: '2026-06-29T00:00:00.000Z',
      },
      crm_payload: { customScore: 9, ownerHint: 'desk' },
      erp: { revenue: { lastTransactedDate: '2026-06-01' } },
    })
    assert.equal(payload.lastOrderCreatedAt, '2026-06-29T00:00:00.000Z')
    assert.equal(payload.customScore, 9)
    assert.equal(payload.ownerHint, 'desk')
    assert.equal(payload.dealCount, 1)
    assert.equal(payload.notes, undefined)
    assert.ok(!payload.deals)
  })

  it('maps lastOrderCreatedAt onto enterprise leads crm_payload', () => {
    const row = buildEnterpriseLeadRow(
      {
        lead: { id: 'lead_1', email: 'a@b.com', company: 'Zenith' },
        crm: { status: 'new', tagIds: ['ops'], lastOrderCreatedAt: '2026-06-29T00:00:00.000Z' },
        crm_payload: { playbook: 'keep-me' },
        organizationId: 'org_x',
      },
      { organizationUuid: '11111111-1111-1111-1111-111111111111' }
    )
    assert.equal(row.crm_payload.lastOrderCreatedAt, '2026-06-29T00:00:00.000Z')
    assert.equal(row.crm_payload.playbook, 'keep-me')
    assert.deepEqual(row.crm_payload.tagIds, ['ops'])
    assert.equal(row.lead_status, 'new')
  })

  it('resolves last order from CRM payload before older ERP dates', () => {
    assert.equal(
      resolveLeadLastOrderCreatedAt({
        crm: { lastOrderCreatedAt: '2026-06-29T00:00:00.000Z' },
        erp: { revenue: { lastTransactedDate: '2026-01-01' } },
      }),
      '2026-06-29T00:00:00.000Z'
    )
  })

  it('uses ERP last shipment when CRM lastOrderCreatedAt is missing', () => {
    assert.equal(
      resolveLeadLastOrderCreatedAt({
        lead: { company: 'Acme' },
        erp: { revenue: { lastShipmentDate: '2026-07-22', firstShipmentAt: '2025-01-01' } },
      }),
      '2026-07-22T00:00:00.000Z'
    )
  })
})
