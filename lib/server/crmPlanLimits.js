/** CRM plan tiers — free until usage limits; paid tiers on admin confirm (payment collected separately). */

export const FREE_PLAN = {
  id: 'free',
  label: 'Free CRM',
  maxSeats: 1,
  maxLeads: 100,
  priceInrPerMonth: 0,
  priceDisplay: '₹0',
}

export const STARTER_PLAN = {
  id: 'starter',
  label: 'Starter',
  maxSeats: 5,
  maxLeads: 2000,
  priceInrPerMonth: 999,
  priceDisplay: '₹999',
}

export const GROWTH_PLAN = {
  id: 'growth',
  label: 'Growth',
  maxSeats: 15,
  maxLeads: 10000,
  priceInrPerMonth: 2499,
  priceDisplay: '₹2,499',
}

export const BUSINESS_PLAN = {
  id: 'business',
  label: 'Business',
  maxSeats: 40,
  maxLeads: 50000,
  priceInrPerMonth: 4999,
  priceDisplay: '₹4,999',
}

/** Design partner override — not sold on the public pricing page. */
export const XINDUS_PLAN = {
  id: 'xindus',
  label: 'Xindus',
  maxSeats: 7,
  maxLeads: 1000,
  priceInrPerMonth: 0,
  priceDisplay: 'Customer',
  customerOverride: true,
}

/** @deprecated Prefer BUSINESS_PLAN — kept alias for older Team CRM references */
export const TEAM_PLAN = BUSINESS_PLAN

export const PAID_PLANS = [STARTER_PLAN, GROWTH_PLAN, BUSINESS_PLAN]
export const ALL_PLANS = [FREE_PLAN, ...PAID_PLANS]

const PLAN_BY_ID = Object.fromEntries(
  [...ALL_PLANS, XINDUS_PLAN].map((p) => [p.id, p])
)
/** Starter < Xindus capacity < Growth for upgrade ranking. */
const PLAN_RANK = {
  free: 0,
  starter: 1,
  xindus: 2,
  growth: 3,
  business: 4,
}

const UPGRADE_PROMPT_RATIO = 0.8

export function isXindusOrg(org) {
  if (!org) return false
  const id = String(org.id || '')
    .trim()
    .toLowerCase()
  if (id === 'org-xindus' || id.includes('xindus')) return true
  const name = String(org.name || '')
    .trim()
    .toLowerCase()
  if (name.includes('xindus')) return true
  const domain = String(org.domain || org.emailDomain?.name || '')
    .trim()
    .toLowerCase()
  if (domain === 'xindus.net' || domain.endsWith('.xindus.net')) return true
  return false
}

export function getPlanById(planId) {
  const id = String(planId || '')
    .trim()
    .toLowerCase()
  if (id === 'team') return BUSINESS_PLAN
  return PLAN_BY_ID[id] || null
}

export function resolvePlanForOrg(org) {
  const tier = String(org?.planTier || 'free').toLowerCase()
  if (tier === 'team') return BUSINESS_PLAN
  if (tier === 'growth') return GROWTH_PLAN
  if (tier === 'business') return BUSINESS_PLAN
  if (tier === 'starter') return STARTER_PLAN
  if (tier === 'xindus') return XINDUS_PLAN
  // Design partner: treat as paid customer plan (7 seats / 1,000 leads), not Free.
  if (isXindusOrg(org)) return XINDUS_PLAN
  return PLAN_BY_ID[tier] || FREE_PLAN
}

export function listUpgradePlans(org) {
  const current = resolvePlanForOrg(org)
  const rank = PLAN_RANK[current.id] ?? 0
  return PAID_PLANS.filter((p) => (PLAN_RANK[p.id] ?? 0) > rank)
}

function quoteForPlan(plan) {
  return {
    planId: plan.id,
    planLabel: plan.label,
    amountInr: plan.priceInrPerMonth,
    amountDisplay: `${plan.priceDisplay}/month`,
    period: 'month',
    maxSeats: plan.maxSeats,
    maxLeads: plan.maxLeads,
    includes: [
      `Up to ${plan.maxSeats} team seats`,
      `Up to ${plan.maxLeads.toLocaleString('en-IN')} pipeline leads`,
      'CRM, imports, team roles, and calendar',
    ],
  }
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
  const upgrades = listUpgradePlans(org)
  const canUpgrade = upgrades.length > 0

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
    canUpgrade,
    showUpgradePrompt: canUpgrade && (nearLimit || atSeatLimit || atLeadLimit || plan.id === 'free'),
  }
}

/** Primary next-tier quote (backward compatible single object). */
export function buildUpgradeQuote(org) {
  const upgrades = listUpgradePlans(org)
  if (!upgrades.length) return null
  return quoteForPlan(upgrades[0])
}

/** All available upgrade quotes from current tier. */
export function buildUpgradeQuotes(org) {
  return listUpgradePlans(org).map(quoteForPlan)
}

export function assertWithinPlanLimits(store, org, { extraSeats = 0, extraLeads = 0 } = {}) {
  const plan = resolvePlanForOrg(org)
  const seats = countOrgSeats(store, org?.id) + extraSeats
  const leads = countOrgLeads(store, org?.id) + extraLeads
  if (seats > plan.maxSeats) {
    throw new Error(
      `${plan.label} supports ${plan.maxSeats} team seat${plan.maxSeats === 1 ? '' : 's'}. Confirm a plan upgrade in Workspace settings to add more.`
    )
  }
  if (leads > plan.maxLeads) {
    throw new Error(
      `${plan.label} supports ${plan.maxLeads.toLocaleString('en-IN')} pipeline leads. Confirm a plan upgrade in Workspace settings to add more.`
    )
  }
}

export function confirmOrgPlanUpgrade(org, { planId, confirmedByUserId } = {}) {
  const current = resolvePlanForOrg(org)
  const available = listUpgradePlans(org)
  let target = planId ? getPlanById(planId) : available[0] || null
  if (planId && String(planId).toLowerCase() === 'team') {
    target = BUSINESS_PLAN
  }
  if (!target || target.id === 'free') {
    throw new Error('Choose a paid plan to upgrade')
  }
  if ((PLAN_RANK[target.id] ?? 0) <= (PLAN_RANK[current.id] ?? 0)) {
    throw new Error(`Workspace is already on ${current.label} or a higher plan`)
  }
  if (!available.some((p) => p.id === target.id)) {
    throw new Error(`Cannot upgrade to ${target.label} from ${current.label}`)
  }

  const now = new Date().toISOString()
  org.planTier = target.id
  org.seatLimit = target.maxSeats
  org.leadLimit = target.maxLeads
  org.pendingPayment = {
    planId: target.id,
    amountInr: target.priceInrPerMonth,
    amountDisplay: target.priceDisplay,
    period: 'month',
    status: 'pending',
    confirmedAt: now,
    confirmedByUserId: confirmedByUserId || null,
  }
  return org
}
