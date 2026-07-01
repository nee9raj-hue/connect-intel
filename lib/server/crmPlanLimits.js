/** CRM plan tiers — free until usage limits; growth on admin confirm (payment collected separately). */

export const FREE_PLAN = {
  id: 'free',
  label: 'Free CRM',
  maxSeats: 5,
  maxLeads: 500,
  priceInrPerMonth: 0,
  priceDisplay: '₹0',
}

export const GROWTH_PLAN = {
  id: 'growth',
  label: 'Team CRM',
  maxSeats: 40,
  maxLeads: 10000,
  priceInrPerMonth: 4999,
  priceDisplay: '₹4,999',
}

const UPGRADE_PROMPT_RATIO = 0.8

export function resolvePlanForOrg(org) {
  const tier = String(org?.planTier || 'free').toLowerCase()
  if (tier === 'growth') return GROWTH_PLAN
  return FREE_PLAN
}

export function countOrgSeats(store, organizationId) {
  if (!organizationId) return 1
  const activeMembers = (store.organizationMemberships || []).filter(
    (m) => m.organizationId === organizationId && m.status !== 'inactive'
  ).length
  const pendingInvites = (store.organizationInvites || []).filter(
    (i) => i.organizationId === organizationId && i.status === 'pending'
  ).length
  return Math.max(1, activeMembers + pendingInvites)
}

export function countOrgLeads(store, organizationId, userId) {
  if (!organizationId) {
    return (store.savedLeads || []).filter((e) => e.userId === userId).length
  }
  return (store.savedLeads || []).filter((e) => e.organizationId === organizationId).length
}

export function buildPlanUsage(store, org, user) {
  const plan = resolvePlanForOrg(org)
  const seats = countOrgSeats(store, org?.id || user?.organizationId)
  const leads = countOrgLeads(store, org?.id || user?.organizationId, user?.id)
  const seatPct = plan.maxSeats > 0 ? seats / plan.maxSeats : 0
  const leadPct = plan.maxLeads > 0 ? leads / plan.maxLeads : 0
  const atSeatLimit = seats >= plan.maxSeats
  const atLeadLimit = leads >= plan.maxLeads
  const nearLimit = seatPct >= UPGRADE_PROMPT_RATIO || leadPct >= UPGRADE_PROMPT_RATIO

  return {
    planId: plan.id,
    planLabel: plan.label,
    seats,
    maxSeats: plan.maxSeats,
    leads,
    maxLeads: plan.maxLeads,
    seatPct: Math.min(100, Math.round(seatPct * 100)),
    leadPct: Math.min(100, Math.round(leadPct * 100)),
    atSeatLimit,
    atLeadLimit,
    nearLimit,
    canUpgrade: plan.id === 'free',
    showUpgradePrompt: plan.id === 'free' && (nearLimit || atSeatLimit || atLeadLimit),
  }
}

export function buildUpgradeQuote(org) {
  if (resolvePlanForOrg(org).id !== 'free') return null
  return {
    planId: GROWTH_PLAN.id,
    planLabel: GROWTH_PLAN.label,
    amountInr: GROWTH_PLAN.priceInrPerMonth,
    amountDisplay: `${GROWTH_PLAN.priceDisplay}/month`,
    period: 'month',
    includes: [
      `Up to ${GROWTH_PLAN.maxSeats} team seats`,
      `Up to ${GROWTH_PLAN.maxLeads.toLocaleString('en-IN')} pipeline leads`,
      'Team CRM, imports, and calendar',
    ],
  }
}

export function assertWithinPlanLimits(store, org, { extraSeats = 0, extraLeads = 0 } = {}) {
  const plan = resolvePlanForOrg(org)
  const seats = countOrgSeats(store, org?.id) + extraSeats
  const leads = countOrgLeads(store, org?.id) + extraLeads
  if (seats > plan.maxSeats) {
    throw new Error(
      `Free plan supports ${plan.maxSeats} team seats. Confirm a Team CRM upgrade in Workspace settings to add more.`
    )
  }
  if (leads > plan.maxLeads) {
    throw new Error(
      `Free plan supports ${plan.maxLeads.toLocaleString('en-IN')} pipeline leads. Confirm a Team CRM upgrade in Workspace settings to import more.`
    )
  }
}

export function confirmOrgPlanUpgrade(org, { confirmedByUserId } = {}) {
  const now = new Date().toISOString()
  org.planTier = GROWTH_PLAN.id
  org.seatLimit = GROWTH_PLAN.maxSeats
  org.leadLimit = GROWTH_PLAN.maxLeads
  org.pendingPayment = {
    planId: GROWTH_PLAN.id,
    amountInr: GROWTH_PLAN.priceInrPerMonth,
    amountDisplay: GROWTH_PLAN.priceDisplay,
    period: 'month',
    status: 'pending',
    confirmedAt: now,
    confirmedByUserId: confirmedByUserId || null,
  }
  return org
}
