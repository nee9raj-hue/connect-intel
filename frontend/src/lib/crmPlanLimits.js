/** Client mirror of server CRM plan tiers (display only). */

export const FREE_PLAN = {
  id: 'free',
  label: 'Free CRM',
  maxSeats: 5,
  maxLeads: 500,
  priceDisplay: '₹0',
}

export const GROWTH_PLAN = {
  id: 'growth',
  label: 'Team CRM',
  maxSeats: 40,
  maxLeads: 10000,
  priceDisplay: '₹4,999',
}

export const FREE_TIER_HIGHLIGHTS = [
  { title: '5 team seats', detail: 'Enough for a small sales pod' },
  { title: '500 pipeline leads', detail: 'Import CSV or add manually' },
  { title: 'No card required', detail: 'Upgrade only when you outgrow free' },
]

export const CRM_ONBOARDING_STEPS = [
  { step: '1', title: 'Create workspace', detail: 'Work email + password' },
  { step: '2', title: 'Import pipeline', detail: 'CSV or manual leads' },
  { step: '3', title: 'Invite teammates', detail: 'Roles when you are ready' },
  { step: '4', title: 'Connect Gmail', detail: 'Optional — send from CRM later' },
]
