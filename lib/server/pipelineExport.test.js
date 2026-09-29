import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pipelineWorkbookRows } from './pipelineExport.js'

describe('pipelineWorkbookRows', () => {
  it('creates lead and detailed deal sheets from filtered pipeline rows', () => {
    const { leadRows, dealRows } = pipelineWorkbookRows(
      [
        {
          id: 'lead-1',
          firstName: 'Neeraj',
          lastName: 'Kumar',
          company: 'Xindus',
          phone: '8800260860',
          email: 'nee9raj@example.com',
          assignedToUserId: 'user-1',
          erp: { revenue: { lastShipmentDate: '2026-09-20' } },
          erpTags: [{ name: 'Non Large B2B' }],
          crm: {
            status: 'qualified',
            tagIds: ['tag-1'],
            notes: 'Asked for a follow-up next week.',
            lastCommunicationAt: '2026-09-21T11:00:00.000Z',
            deals: [
              {
                id: 'deal-1',
                name: 'October shipment',
                stage: 'quoted',
                amount: 45000,
                currency: 'INR',
                expectedCloseDate: '2026-10-01',
                notes: 'Waiting for rates.',
                freight: {
                  customerType: 'spot_rfq',
                  transportMode: 'air',
                  pickupCity: 'Hyderabad',
                  pickupZip: '500001',
                  deliveryCity: 'Delhi',
                  deliveryZip: '110001',
                  grossWeightKg: 240,
                  invoiceAmount: 48000,
                },
              },
            ],
          },
        },
      ],
      {
        users: [{ id: 'user-1', name: 'Revenue B2B' }],
        organization: { leadTags: [{ id: 'tag-1', name: 'Priority' }] },
      }
    )

    assert.equal(leadRows.length, 1)
    assert.equal(leadRows[0]['Lead owner'], 'Revenue B2B')
    assert.equal(leadRows[0]['Last shipment date'], '2026-09-20')
    assert.equal(leadRows[0].Tags, 'Priority, Non Large B2B')
    assert.equal(leadRows[0].Deals, 1)
    assert.equal(dealRows.length, 1)
    assert.equal(dealRows[0].Deal, 'October shipment')
    assert.equal(dealRows[0]['Route / lane'], 'Hyderabad 500001 → Delhi 110001')
    assert.equal(dealRows[0]['Gross weight'], '240 kg')
    assert.equal(dealRows[0].Freight, 45000)
    assert.equal(dealRows[0].Revenue, 48000)
    assert.equal(dealRows[0].Notes, 'Waiting for rates.')
  })
})
