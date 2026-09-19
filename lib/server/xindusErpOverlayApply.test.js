import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pipelineLastOrderPeriodOr, pipelineOnboardedPeriodOr } from './pipelineDashboardPeriod.js'
import { indexOverlays, matchLeadToOverlay, applyErpOverlayToLeadEntry, overlayOwnerUserIds, resetErpOwnerMappingOnEntry } from './xindusErpOverlayApply.js'
import { xindusIdFromLeadEntry } from '../xindusCustomerErp.js'
import { buildOwnerMemberIndex } from '../erpOwner.js'

describe('pipelineDashboardPeriod', () => {
  it('filters ERP date-only shipment columns with YYYY-MM-DD bounds', () => {
    const filter = pipelineLastOrderPeriodOr('2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')
    assert.match(filter, /lastShipmentDate\.gte\.2026-01-01/)
    assert.match(filter, /lastShipmentDate\.lt\.2027-01-01/)
    assert.match(filter, /lastOrderCreatedAt\.gte\.2026-01-01T00%3A00%3A00\.000Z/)
  })

  it('filters onboarding dates with date-only bounds', () => {
    const filter = pipelineOnboardedPeriodOr('2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
    assert.match(filter, /firstShipmentAt\.gte\.2026-09-01/)
    assert.match(filter, /firstShipmentAt\.lt\.2026-10-01/)
    assert.doesNotMatch(filter, /2026-10-01T/)
  })
})

describe('xindusErpOverlayApply match', () => {
  it('matches company names that share a prefix after legal-suffix strip', () => {
    const index = indexOverlays([
      {
        company: 'Shree Enterprises Private Limited',
        xindusId: '4411',
        erp: { revenue: { lastShipmentDate: '2026-07-22', shipmentCount: 3 } },
      },
    ])
    const hit = matchLeadToOverlay(
      { lead: { company: 'Shree Enterprises JPR' } },
      index
    )
    assert.equal(hit?.xindusId, '4411')
  })

  it('does not match a 3-letter brand onto a different legal name', () => {
    const index = indexOverlays([
      {
        company: 'XLP Logistics Private Limited',
        xindusId: '8801',
        erp: { revenue: { lastShipmentDate: '2026-08-20', shipmentCount: 11 } },
      },
    ])
    const hit = matchLeadToOverlay({ lead: { company: 'XLP' } }, index)
    assert.equal(hit, null)
  })

  it('matches XLP ENGINEERS by GST when the company string is messy', () => {
    const index = indexOverlays([
      {
        company: 'XLP ENGINEERS PVT LTD',
        gst: '06AAACX0076C1ZR',
        xindusId: '1443',
        phone: '9310951010',
        email: 'aseem@cosmogroup.in',
        erp: { revenue: { lastShipmentDate: '2026-07-11', shipmentCount: 10 } },
      },
    ])
    const hit = matchLeadToOverlay(
      { lead: { company: 'XLP ENGINEERS PVT LTD', gstn: '06AAACX0076C1ZR', phone: '9310951010' } },
      index
    )
    assert.equal(hit?.xindusId, '1443')
    assert.equal(hit?.overlay?.revenue?.shipmentCount, 10)
  })

  it('matches XLP ENGINEERS by Zoho CRM id from the Excel dump', () => {
    const index = indexOverlays([
      {
        company: 'XLP ENGINEERS PVT LTD',
        crmId: '426904000018309832',
        xindusId: '1443',
        erp: { revenue: { lastShipmentDate: '2026-07-11', shipmentCount: 10 } },
      },
    ])
    const hit = matchLeadToOverlay(
      { lead: { id: '426904000018309832', company: 'Something Else' } },
      index
    )
    assert.equal(hit?.xindusId, '1443')
  })

  it('matches a numeric Xindus id stored on erp.revenue', () => {
    assert.equal(
      xindusIdFromLeadEntry({ erp: { revenue: { xindusId: '4411' } } }),
      '4411'
    )
    const index = indexOverlays([
      { xindusId: '4411', company: 'Other', erp: { revenue: { lastShipmentDate: '2026-07-01' } } },
    ])
    const hit = matchLeadToOverlay({ erp: { revenue: { xindusId: '4411' } }, lead: { company: 'Nope' } }, index)
    assert.equal(hit?.xindusId, '4411')
  })
})

describe('xindusErpOverlayApply owner reclaim', () => {
  it('assigns ERP sales owner and last shipment, and unassigns unmatched Vivek leads', () => {
    const store = {
      users: [
        { id: 'u-vivek', email: 'vivek.kumar@xindus.net', name: 'Vivek Kumar Singh' },
        { id: 'u-navya', email: 'navya@xindus.net', name: 'Navya Sagar' },
      ],
      organizationMemberships: [
        { userId: 'u-vivek', organizationId: 'org1', status: 'active' },
        { userId: 'u-navya', organizationId: 'org1', status: 'active' },
      ],
    }
    const ownerIndex = buildOwnerMemberIndex(store, 'org1')
    const overlays = [
      {
        company: 'NAGINA EXPRESS',
        phone: '8350462242',
        xindusId: '9001',
        ownerAuthoritative: true,
        erp: {
          revenue: { lastShipmentDate: '2026-07-25', shipmentCount: 4 },
          ownership: { salesOwner: { name: 'Vivek Kumar Singh' } },
        },
      },
    ]
    const overlayIndex = indexOverlays(overlays)
    const overlayOwnerIds = overlayOwnerUserIds(overlays, ownerIndex, store, 'org1')

    const nagina = {
      assignedToUserId: 'u-navya',
      lead: { company: 'NAGINA EXPRESS', phone: '8350462242' },
    }
    const stray = {
      assignedToUserId: 'u-vivek',
      lead: { company: 'Unrelated Craft Studio', name: 'ram saini' },
      erp: { ownership: { salesOwner: { name: 'Vivek Kumar Singh' } } },
    }

    const hit = applyErpOverlayToLeadEntry(nagina, {
      overlayIndex,
      ownerIndex,
      overlayOwnerIds,
      reclaimUnmatchedOwners: true,
    })
    assert.equal(hit.matched, true)
    assert.equal(nagina.assignedToUserId, 'u-vivek')
    assert.equal(nagina.tradingProfile.lastShipmentDate, '2026-07-25')
    assert.equal(nagina.erp.revenue.lastShipmentDate, '2026-07-25')

    const reclaim = applyErpOverlayToLeadEntry(stray, {
      overlayIndex,
      ownerIndex,
      overlayOwnerIds,
      reclaimUnmatchedOwners: true,
    })
    assert.equal(reclaim.matched, false)
    assert.equal(reclaim.reclaimed, true)
    assert.equal(stray.assignedToUserId, null)
    assert.equal(stray.erp.ownership.salesOwner, null)
  })

  it('does not stamp Metabase dump Sales Owner onto CRM when the ops list is the owner source', () => {
    const store = {
      users: [
        { id: 'u-vivek', email: 'vivek.singh@xindus.net', name: 'Vivek Kumar Singh' },
        { id: 'u-lokesh', email: 'lokesh.joshi@xindus.net', name: 'Lokesh Joshi' },
      ],
      organizationMemberships: [
        { userId: 'u-vivek', organizationId: 'org1', status: 'active' },
        { userId: 'u-lokesh', organizationId: 'org1', status: 'active' },
      ],
    }
    const ownerIndex = buildOwnerMemberIndex(store, 'org1')
    const dumpOverlays = [
      {
        company: 'Chuninda',
        phone: '8861057234',
        xindusId: '5668',
        gst: '03AOJPG8742E1Z4',
        ownerAuthoritative: false,
        erp: {
          revenue: {
            xindusId: '5668',
            gstn: '03AOJPG8742E1Z4',
            tags: [{ tagName: 'Churn', type: 'automatic' }],
            customerCreatedAt: '2026-02-26',
          },
          ownership: {
            salesOwner: {
              name: 'Vivek Kumar Singh',
              email: 'vivek.singh@xindus.net',
              erpStaffId: '0',
            },
          },
        },
      },
    ]
    const listOverlays = [
      {
        ...dumpOverlays[0],
        ownerAuthoritative: true,
        erp: {
          ...dumpOverlays[0].erp,
          ownership: {
            salesOwner: { name: 'Lokesh Joshi', email: 'lokesh.joshi@xindus.net', erpStaffId: '0' },
          },
        },
      },
    ]

    const chuninda = {
      assignedToUserId: 'u-vivek',
      savedByUserId: 'u-vivek',
      crm: { status: 'onboarding' },
      lead: { company: 'Chuninda', phone: '91-8861057234' },
    }

    applyErpOverlayToLeadEntry(chuninda, {
      overlayIndex: indexOverlays(dumpOverlays),
      ownerIndex,
    })
    assert.equal(chuninda.assignedToUserId, null)
    assert.equal(chuninda.erp.ownership.salesOwner, null)
    assert.equal(chuninda.crm.status, 'churned')

    applyErpOverlayToLeadEntry(chuninda, {
      overlayIndex: indexOverlays(listOverlays),
      ownerIndex,
    })
    assert.equal(chuninda.assignedToUserId, 'u-lokesh')
    assert.equal(chuninda.erp.ownership.salesOwner.email, 'lokesh.joshi@xindus.net')
  })

  it('resetErpOwnerMappingOnEntry clears owner and keeps deals', () => {
    const entry = {
      assignedToUserId: 'u-vivek',
      savedByUserId: 'u-vivek',
      crm: { status: 'onboarding', deals: [{ id: 'd1', stage: 'won', amount: 10 }] },
      erp: {
        revenue: { xindusId: '5668' },
        ownership: { salesOwner: { name: 'Vivek Kumar Singh' } },
      },
      lead: { company: 'Chuninda', phone: '91-8861057234' },
    }
    const result = resetErpOwnerMappingOnEntry(entry)
    assert.equal(result.changed, true)
    assert.equal(entry.assignedToUserId, null)
    assert.equal(entry.erp.ownership.salesOwner, null)
    assert.equal(entry.crm.deals[0].id, 'd1')
    assert.equal(entry.savedByUserId, 'u-vivek')
  })
})
