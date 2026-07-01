import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOrganizationSqlPayload,
  buildProfileSqlPayload,
  isOrgSqlSyncEnabled,
  mapMembershipRole,
} from './orgSqlSync.js'

describe('mapMembershipRole', () => {
  it('maps org_admin to admin', () => {
    assert.equal(mapMembershipRole({ role: 'org_admin' }), 'admin')
  })

  it('maps manager pipeline role', () => {
    assert.equal(mapMembershipRole({ pipelineRole: 'manager' }), 'manager')
  })

  it('defaults to rep', () => {
    assert.equal(mapMembershipRole({}), 'rep')
  })
})

describe('buildOrganizationSqlPayload', () => {
  it('includes legacy_id and company metadata', () => {
    const payload = buildOrganizationSqlPayload({
      id: 'org_1',
      name: 'Acme',
      domain: 'acme.com',
      accountType: 'company',
      ownerUserId: 'u1',
      planTier: 'free',
    })
    assert.equal(payload.legacy_id, 'org_1')
    assert.equal(payload.company_name, 'Acme')
    assert.equal(payload.metadata.planTier, 'free')
  })
})

describe('buildProfileSqlPayload', () => {
  it('links profile to org uuid', () => {
    const payload = buildProfileSqlPayload(
      { id: 'u1', email: 'Rep@Acme.com', name: 'Rep', accountType: 'company' },
      'uuid-org',
      { pipelineRole: 'member', canSearch: true }
    )
    assert.equal(payload.organization_id, 'uuid-org')
    assert.equal(payload.email, 'rep@acme.com')
    assert.equal(payload.role, 'rep')
    assert.equal(payload.can_search, true)
  })

  it('includes marketing role and membership status in metadata', () => {
    const payload = buildProfileSqlPayload(
      { id: 'u1', email: 'm@acme.com', accountType: 'company' },
      'uuid-org',
      { pipelineRole: 'manager', marketingRole: 'marketing_manager', status: 'active' }
    )
    assert.equal(payload.role, 'manager')
    assert.equal(payload.metadata.marketingRole, 'marketing_manager')
    assert.equal(payload.metadata.membershipStatus, 'active')
  })

  it('grants can_search to org owner fallback membership', () => {
    const payload = buildProfileSqlPayload(
      { id: 'u1', email: 'owner@acme.com', accountType: 'company' },
      'uuid-org',
      { role: 'org_admin', pipelineRole: 'org_admin' }
    )
    assert.equal(payload.role, 'admin')
    assert.equal(payload.can_search, true)
  })
})

describe('isOrgSqlSyncEnabled', () => {
  it('returns boolean without throwing', () => {
    assert.equal(typeof isOrgSqlSyncEnabled(), 'boolean')
  })
})
