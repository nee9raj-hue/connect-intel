/** Client mirror of server CRM plan tiers (display only). */

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

/** Design partner override — not listed on public pricing. */
export const XINDUS_PLAN = {
  id: 'xindus',
  label: 'Xindus',
  maxSeats: 7,
  maxLeads: 1000,
  priceInrPerMonth: 0,
  priceDisplay: 'Customer',
  customerOverride: true,
}

export const PAID_PLANS = [STARTER_PLAN, GROWTH_PLAN, BUSINESS_PLAN]
export const ALL_PLANS = [FREE_PLAN, ...PAID_PLANS]

export const FREE_TIER_HIGHLIGHTS = [
  { title: '1 user seat', detail: 'One workspace for your org' },
  { title: '100 pipeline leads', detail: 'Import CSV or add manually' },
  { title: 'No card required', detail: 'Upgrade only when you outgrow free' },
]

export const CRM_ONBOARDING_STEPS = [
  { step: '1', title: 'Create workspace', detail: 'Work email + password' },
  { step: '2', title: 'Import pipeline', detail: 'CSV or manual leads' },
  { step: '3', title: 'Invite teammates', detail: 'Roles when you are ready' },
  { step: '4', title: 'Connect Gmail', detail: 'Optional — send from CRM later' },
]

export function getPlanById(planId) {
  const id = String(planId || '')
    .trim()
    .toLowerCase()
  if (id === 'team') return BUSINESS_PLAN
  if (id === 'xindus') return XINDUS_PLAN
  return ALL_PLANS.find((p) => p.id === id) || FREE_PLAN
}
