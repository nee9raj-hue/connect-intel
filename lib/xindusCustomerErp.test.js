import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { erpFromXindusCustomerRow, matchKeysFromXindusRow } from './xindusCustomerErp.js'
import { erpFromImportRow } from './leadErp.js'

describe('xindusCustomerErp', () => {
  it('maps customer excel columns into revenue and finance', () => {
    const overlay = erpFromXindusCustomerRow({
      ID: 17,
      'Shipment Count': 35,
      'Last Transacted Date': '2026-07-22',
      'Last Invoice Date': '2024-06-10',
      Overdues: false,
      'Pending Payment Limit': 500000,
      'Payment Method': 'CREDITS',
      'Billing Currency': 'INR',
      'Shipment Method': 'AE',
      'Ship Type': 'trader',
      'Total Savings': 1806.86,
      'Credit Period': '7',
      'Bank Name': 'HDFC',
      'Bank Account Number': '123456789012',
      IFSC: 'HDFC0001234',
      'Should Block': false,
    })
    assert.equal(overlay.revenue.shipmentCount, 35)
    assert.equal(overlay.revenue.lastShipmentDate, '2026-07-22')
    assert.equal(overlay.revenue.shipmentMethod, 'AE')
    assert.equal(overlay.revenue.totalSavings, 1806.86)
    assert.equal(overlay.finance.lastInvoiceDate, '2024-06-10')
    assert.equal(overlay.finance.creditLimit, 500000)
    assert.equal(overlay.finance.paymentMethod, 'CREDITS')
    assert.equal(overlay.finance.overdue, false)
    assert.equal(overlay.finance.bankAccountMasked, '•••• 9012')
    assert.equal(overlay.finance.invoiceStatus, 'invoiced')
  })

  it('maps sales owner and onboarding dates', () => {
    const overlay = erpFromXindusCustomerRow({
      'Sales Owner': { name: 'Priya Shah', email: 'priya@xindus.com' },
      'Created On': '2024-01-15',
      'First Shipment Date': '2024-02-01',
    })
    assert.equal(overlay.ownership.salesOwner.email, 'priya@xindus.com')
    assert.equal(overlay.revenue.firstShipmentAt, '2024-02-01')
    assert.equal(overlay.revenue.customerCreatedAt, '2024-01-15')
    assert.equal(overlay.revenue.onboardedAt, '2024-02-01')
  })

  it('marks overdue accounts', () => {
    const overlay = erpFromXindusCustomerRow({
      Overdues: true,
      'Should Block': true,
    })
    assert.equal(overlay.finance.overdue, true)
    assert.equal(overlay.finance.invoiceStatus, 'blocked')
  })

  it('extracts match keys', () => {
    const keys = matchKeysFromXindusRow({
      ID: '17.0',
      Phone: '91-9899800487',
      Email: 'Ramsutar.Agarwal@theuric.com',
    })
    assert.equal(keys.xindusId, '17')
    assert.match(keys.phone, /9899800487/)
    assert.equal(keys.email, 'ramsutar.agarwal@theuric.com')
  })

  it('still maps generic import aliases', () => {
    const erp = erpFromImportRow({
      shipment_count: '4',
      last_shipment_date: '2026-08-01',
      invoice_status: 'partial',
      pending_payments: '15000',
    })
    assert.equal(erp.revenue.shipmentCount, 4)
    assert.equal(erp.finance.invoiceStatus, 'partial')
    assert.equal(erp.finance.pendingPayments, 15000)
  })
})
