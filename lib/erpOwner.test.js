import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOwnerMemberIndex,
  canonicalErpOwner,
  dashboardSalesOwnerId,
  matchErpOwnerUserId,
  parseErpPerson,
} from './erpOwner.js'

describe('erpOwner', () => {
  it('parses json, email, and name people', () => {
    assert.equal(parseErpPerson({ Name: 'Priya', Email: 'priya@xindus.com' }).email, 'priya@xindus.com')
    assert.equal(parseErpPerson('priya@xindus.com').email, 'priya@xindus.com')
    assert.equal(parseErpPerson('Priya Shah').name, 'Priya Shah')
  })

  it('prefers sales owner then account then lead', () => {
    const person = canonicalErpOwner({
      accountOwner: { name: 'A', email: 'a@x.test' },
      salesOwner: { name: 'S', email: 's@x.test' },
      leadOwner: { name: 'L', email: 'l@x.test' },
    })
    assert.equal(person.email, 's@x.test')
  })

  it('maps ERP owner to CRM member and leaves importer unassigned', () => {
    const index = buildOwnerMemberIndex(
      {
        users: [
          { id: 'neeraj', email: 'neeraj@connectintel.net', name: 'Neeraj' },
          { id: 'u-priya', email: 'priya@xindus.com', name: 'Priya' },
        ],
        organizationMemberships: [
          { userId: 'neeraj', organizationId: 'org1', status: 'active' },
          { userId: 'u-priya', organizationId: 'org1', status: 'active' },
        ],
      },
      'org1'
    )
    const withOwner = {
      assignedToUserId: 'neeraj',
      erp: { ownership: { salesOwner: { name: 'Priya', email: 'priya@xindus.com' } } },
    }
    const withoutOwner = { assignedToUserId: 'neeraj', erp: { ownership: {} } }
    assert.equal(dashboardSalesOwnerId(withOwner, index), 'u-priya')
    assert.equal(dashboardSalesOwnerId(withoutOwner, index), 'unassigned')
  })

  it('maps ERP first name onto a unique CRM member (Tanishq)', () => {
    const index = buildOwnerMemberIndex(
      {
        users: [
          { id: 'u-tan', email: 'tanishq@xindus.net', name: 'Tanishq' },
          { id: 'u-priya', email: 'priya@xindus.net', name: 'Priya Shah' },
        ],
        organizationMemberships: [
          { userId: 'u-tan', organizationId: 'org1', status: 'active' },
          { userId: 'u-priya', organizationId: 'org1', status: 'active' },
        ],
      },
      'org1'
    )
    assert.equal(
      matchErpOwnerUserId({ name: 'Tanishq', email: 'tanishq@xindus.net' }, index),
      'u-tan'
    )
    assert.equal(matchErpOwnerUserId({ name: 'Tanishq' }, index), 'u-tan')
    assert.equal(matchErpOwnerUserId({ name: 'Tanishq Kumar' }, index), 'u-tan')
  })

  it('prefers the logged-in Tanishq over an ERP stub with the same first name', () => {
    const index = buildOwnerMemberIndex(
      {
        users: [
          { id: 'stub-tan', email: null, name: 'Tanishq', source: 'erp-owner' },
          {
            id: 'u-tan',
            email: 'tanishq@xindus.net',
            name: 'Tanishq Kumar',
            lastLoginAt: '2026-09-17T00:00:00.000Z',
          },
        ],
        organizationMemberships: [
          { userId: 'stub-tan', organizationId: 'org1', status: 'active' },
          { userId: 'u-tan', organizationId: 'org1', status: 'active' },
        ],
      },
      'org1',
      { preferUserId: 'u-tan' }
    )
    assert.equal(matchErpOwnerUserId({ name: 'Tanishq' }, index), 'u-tan')
    assert.equal(matchErpOwnerUserId({ name: 'Tanishq Kumar' }, index), 'u-tan')
  })

  it('does not map Vivek Kumar Singh onto a different Vivek by first name', () => {
    const index = buildOwnerMemberIndex(
      {
        users: [
          { id: 'u-vivek', email: 'vivek.kumar@xindus.net', name: 'Vivek Kumar Singh' },
          { id: 'u-other', email: 'vivek.sharma@xindus.net', name: 'Vivek Sharma' },
        ],
        organizationMemberships: [
          { userId: 'u-vivek', organizationId: 'org1', status: 'active' },
          { userId: 'u-other', organizationId: 'org1', status: 'active' },
        ],
      },
      'org1'
    )
    assert.equal(
      matchErpOwnerUserId({ name: 'Vivek Kumar Singh', email: 'vivek.kumar@xindus.net' }, index),
      'u-vivek'
    )
    assert.equal(matchErpOwnerUserId({ name: 'Vivek Sharma' }, index), 'u-other')
    assert.equal(matchErpOwnerUserId({ name: 'Vivek' }, index), null)
  })
})
