import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  overlayFromXindusApiCustomer,
  overlaysFromXindusApiCustomers,
  stripControlTowerMetrics,
} from './xindusErpCustomerFeed.js'
import { resolveXindusErpSyncMode } from './server/xindusErpCustomerSync.js'
import { suggestCrmStatusFromErp } from './erpAccountStage.js'
import { normalizeLeadErp } from './leadErp.js'

describe('xindus ERP customer-service feed', () => {
  const sample = {
    xindus_customer_id: '1443',
    crm_id: '426904000018309832',
    company_legal_name: 'XLP ENGINEERS PVT LTD',
    contact_name: 'Aseem Datta',
    phone: '9310951010',
    email: 'aseem@cosmogroup.in',
    gstin: '06AAACX0076C1ZR',
    customer_created_at: '2024-08-16',
    first_shipment_at: '2024-09-01',
    last_shipment_at: '2026-07-11',
    shipment_count: 10,
    last_invoice_date: '2026-07-20',
    overdue: false,
    should_block: false,
    payment_method: 'CREDITS',
    credit_limit: 0,
    bank_account_masked: '•••• 5020',
    business_type: 'b2b',
    channel: 'DIRECT',
    tags: [{ id: '11', name: 'Commercial', type: 'manual' }],
    sales_owner: {
      name: 'Dakash Rantiya',
      email: 'dakash.rantiya@xindus.net',
      phone: '9926475785',
    },
    lifetime_revenue: 999999,
    revenue: 888888,
    avg_shipment_value: 100,
    chargeable_weight_kg: 12,
  }

  it('maps identity, shipment dates, owner, tags and strips Control Tower revenue/weight', () => {
    const packed = overlayFromXindusApiCustomer(sample)
    assert.equal(packed.xindusId, '1443')
    assert.equal(packed.email, 'aseem@cosmogroup.in')
    assert.equal(packed.phone.replace(/\D/g, '').slice(-10), '9310951010')
    assert.equal(packed.company, 'XLP ENGINEERS PVT LTD')
    assert.equal(packed.gst, '06AAACX0076C1ZR')
    assert.equal(packed.erp.revenue.lastShipmentDate, '2026-07-11')
    assert.equal(packed.erp.revenue.firstShipmentAt, '2024-09-01')
    assert.equal(packed.erp.revenue.shipmentCount, 10)
    assert.equal(packed.erp.revenue.xindusId, '1443')
    assert.equal(packed.erp.revenue.businessType, 'b2b')
    assert.equal(packed.erp.finance.lastInvoiceDate, '2026-07-20')
    assert.equal(packed.erp.finance.overdue, false)
    assert.equal(packed.erp.finance.paymentMethod, 'CREDITS')
    assert.equal(packed.erp.finance.bankAccountMasked, '•••• 5020')
    assert.equal(packed.erp.ownership.salesOwner.email, 'dakash.rantiya@xindus.net')
    assert.equal(packed.ownerAuthoritative, true)
    assert.equal(packed.erp.revenue.revenue, undefined)
    assert.ok(!packed.erp.revenue.chargeableWeightKg)
    const normalized = normalizeLeadErp(packed.erp)
    assert.equal(normalized.revenue.revenue, null)
    assert.equal(normalized.revenue.lastShipmentDate, '2026-07-11')
  })

  it('classifies last shipment 11 Jul 2026 as churned using the existing stage rules', () => {
    const packed = overlayFromXindusApiCustomer(sample)
    const entry = { crm: { status: 'new_account' }, lead: { company: packed.company }, erp: packed.erp }
    const now = Date.parse('2026-09-17T00:00:00.000Z')
    assert.equal(suggestCrmStatusFromErp(entry, now), 'churned')
  })

  it('never copies lifetime revenue through stripControlTowerMetrics', () => {
    const stripped = stripControlTowerMetrics({
      revenue: { revenue: 50, lastShipmentDate: '2026-07-11', shipmentCount: 2, periods: [{ year: 2026 }] },
    })
    assert.equal(stripped.revenue.revenue, undefined)
    assert.equal(stripped.revenue.periods, undefined)
    assert.equal(stripped.revenue.lastShipmentDate, '2026-07-11')
  })

  it('maps ops customer-list rows whose sales_owner is a JSON string', () => {
    const packed = overlayFromXindusApiCustomer({
      id: 5668,
      company: 'Chuninda',
      phone: '91-8861057234',
      email: 'chuninda@outlook.com',
      gstn: '03AOJPG8742E1Z4',
      created_on: '2026-02-26 18:09:47',
      sales_owner: '{"id":0,"name":"Lokesh Joshi","email":"lokesh.joshi@xindus.net","phone":"91-000"}',
      kam_info: null,
      tags: '[{"tagName":"Churn","type":"automatic"}]',
      status: 'APPROVED',
      service_node: 'PPNZIPYPOST_3_1',
    })
    assert.equal(packed.xindusId, '5668')
    assert.equal(packed.ownerAuthoritative, true)
    assert.equal(packed.erp.ownership.salesOwner.email, 'lokesh.joshi@xindus.net')
    assert.equal(packed.erp.ownership.salesOwner.name, 'Lokesh Joshi')
    assert.equal(packed.erp.revenue.tags[0].tagName, 'Churn')
  })

  it('keeps ERP tags on the overlay, separate from CRM tags', () => {
    const packed = overlayFromXindusApiCustomer({
      ...sample,
      erp_tags: [
        { name: 'Active', color: '#25D366', type: 'automatic' },
        { name: 'Dummy', color: '#B4876E', type: 'manual' },
      ],
    })
    assert.deepEqual(packed.erp.erpTags, [
      { name: 'Active', color: '#25d366', type: 'automatic' },
      { name: 'Dummy', color: '#b4876e', type: 'manual' },
    ])
  })

  it('builds overlay lists and resolves hourly vs daily mode', () => {
    assert.equal(overlaysFromXindusApiCustomers([sample]).length, 1)
    assert.equal(resolveXindusErpSyncMode('full'), 'full')
    assert.equal(resolveXindusErpSyncMode('incremental'), 'incremental')
    assert.equal(resolveXindusErpSyncMode('', new Date('2026-09-17T21:10:00.000Z')), 'full')
    assert.equal(resolveXindusErpSyncMode('', new Date('2026-09-17T10:10:00.000Z')), 'incremental')
  })
})
