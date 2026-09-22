import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isCustomerPanelAllowed, userHasOrgNavPermission } from './orgNavAccess.js'

const rep = {
  id: 'u1',
  accountType: 'company',
  organizationId: 'org',
  orgPermissions: {
    access_marketing: false,
    view_analytics: false,
    manage_team: false,
  },
}

describe('orgNavAccess', () => {
  it('lets org admins through every permission', () => {
    const admin = { ...rep, isOrgAdmin: true, orgPermissions: {} }
    assert.equal(userHasOrgNavPermission(admin, 'access_marketing'), true)
    assert.equal(isCustomerPanelAllowed(admin, 'marketing'), true)
  })

  it('hides marketing, analytics, and team for a rep when the matrix is off', () => {
    assert.equal(userHasOrgNavPermission(rep, 'access_marketing'), false)
    assert.equal(isCustomerPanelAllowed(rep, 'marketing'), false)
    assert.equal(isCustomerPanelAllowed(rep, 'crm-dashboard'), false)
    assert.equal(isCustomerPanelAllowed(rep, 'crm-log'), false)
    assert.equal(isCustomerPanelAllowed(rep, 'team'), false)
    assert.equal(isCustomerPanelAllowed(rep, 'pipeline'), true)
    assert.equal(isCustomerPanelAllowed(rep, 'lead-tags'), true)
    assert.equal(isCustomerPanelAllowed(rep, 'overview'), true)
  })

  it('shows marketing when the admin enables access_marketing for the role', () => {
    const allowed = { ...rep, orgPermissions: { ...rep.orgPermissions, access_marketing: true } }
    assert.equal(isCustomerPanelAllowed(allowed, 'marketing'), true)
  })
})
