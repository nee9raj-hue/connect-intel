import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildOwnerMemberIndex } from '../erpOwner.js'
import { stampEntryErpOwner } from './erpOwnerLeadClaim.js'

describe('erpOwnerLeadClaim', () => {
  it('assigns ERP sales-owner leads to the matching CRM member', () => {
    const index = buildOwnerMemberIndex(
      {
        users: [{ id: 'u-tan', email: 'tanishq@xindus.net', name: 'Tanishq' }],
        organizationMemberships: [
          { userId: 'u-tan', organizationId: 'org1', status: 'active' },
        ],
      },
      'org1'
    )
    const entry = {
      assignedToUserId: 'neeraj',
      erp: { ownership: { salesOwner: { name: 'Tanishq', email: 'tanishq@xindus.net' } } },
    }
    const { changed } = stampEntryErpOwner(entry, index, { 'u-tan': { teamId: 'team-1' } })
    assert.equal(changed, true)
    assert.equal(entry.assignedToUserId, 'u-tan')
    assert.equal(entry.teamId, 'team-1')
  })

  it('does not steal another rep’s ERP book when claiming one member', () => {
    const index = buildOwnerMemberIndex(
      {
        users: [
          { id: 'u-tan', email: 'tanishq@xindus.net', name: 'Tanishq' },
          { id: 'u-priya', email: 'priya@xindus.net', name: 'Priya' },
        ],
        organizationMemberships: [
          { userId: 'u-tan', organizationId: 'org1', status: 'active' },
          { userId: 'u-priya', organizationId: 'org1', status: 'active' },
        ],
      },
      'org1'
    )
    const entry = {
      assignedToUserId: null,
      erp: { ownership: { salesOwner: { name: 'Priya' } } },
    }
    const { changed } = stampEntryErpOwner(entry, index, {}, { onlyUserId: 'u-tan' })
    assert.equal(changed, false)
    assert.equal(entry.assignedToUserId, null)
  })

  it('reassigns an ERP-stub book to the logged-in member', () => {
    const index = buildOwnerMemberIndex(
      {
        users: [
          { id: 'stub-tan', name: 'Tanishq', source: 'erp-owner' },
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
    const entry = {
      assignedToUserId: 'stub-tan',
      erp: { ownership: { salesOwner: { name: 'Tanishq' } } },
    }
    const { changed } = stampEntryErpOwner(entry, index, {}, { onlyUserId: 'u-tan' })
    assert.equal(changed, true)
    assert.equal(entry.assignedToUserId, 'u-tan')
  })
})
