import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertWithinPlanLimits,
  buildPlanUsage,
  resolvePlanForOrg,
} from './crmPlanLimits.js'

function storeWithUsage({ seats = 1, leads = 0 } = {}) {
  return {
    organizationMemberships: Array.from({ length: seats }, (_, index) => ({
      id: `member-${index}`,
      organizationId: 'org-xindus',
      status: 'active',
    })),
    organizationInvites: [],
    savedLeads: Array.from({ length: leads }, (_, index) => ({
      id: `lead-${index}`,
      organizationId: 'org-xindus',
    })),
  }
}

test('Xindus remains unlimited when its stored tier is a commercial plan', () => {
  const org = { id: 'org-xindus', name: 'Xindus Network Trade Pvt Ltd', planTier: 'growth' }
  const store = storeWithUsage({ seats: 16, leads: 10001 })

  assert.equal(resolvePlanForOrg(org).id, 'xindus')
  assert.doesNotThrow(() => assertWithinPlanLimits(store, org, { extraSeats: 1, extraLeads: 1 }))

  const usage = buildPlanUsage(store, org, { id: 'user-xindus', organizationId: org.id })
  assert.equal(usage.unlimitedSeats, true)
  assert.equal(usage.unlimitedLeads, true)
  assert.equal(usage.atSeatLimit, false)
  assert.equal(usage.atLeadLimit, false)
})

test('commercial Growth workspaces retain their configured capacity checks', () => {
  const org = { id: 'org-growth', name: 'Customer Workspace', planTier: 'growth' }
  const store = {
    ...storeWithUsage({ seats: 1, leads: 0 }),
    organizationMemberships: Array.from({ length: 15 }, (_, index) => ({
      id: `member-${index}`,
      organizationId: org.id,
      status: 'active',
    })),
  }

  assert.equal(resolvePlanForOrg(org).id, 'growth')
  assert.throws(
    () => assertWithinPlanLimits(store, org, { extraSeats: 1 }),
    /Growth supports 15 team seats/
  )
})
