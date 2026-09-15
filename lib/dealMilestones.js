/** Customer-facing deal dates — when events happened, not when they were logged in CRM. */

export const DEAL_MILESTONE_FIELDS = [
  {
    id: 'queryReceivedOn',
    label: 'Query received',
    hint: 'When the customer sent the RFQ',
  },
  {
    id: 'ratesQuotedOn',
    label: 'Rates quoted',
    hint: 'When you sent the rate to the customer',
  },
  {
    id: 'bookedOn',
    label: 'Booked',
    hint: 'When the shipment was booked',
  },
  {
    id: 'wonOn',
    label: 'Won',
    hint: 'When the deal was actually won',
  },
  {
    id: 'lostOn',
    label: 'Lost',
    hint: 'When the deal was actually lost',
  },
]

export const DEAL_MILESTONE_IDS = DEAL_MILESTONE_FIELDS.map((field) => field.id)

export function emptyDealMilestones() {
  return {
    queryReceivedOn: null,
    ratesQuotedOn: null,
    bookedOn: null,
    wonOn: null,
    lostOn: null,
  }
}

export function normalizeDealCalendarDate(value) {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

export function pickDealMilestones(raw = {}) {
  const next = emptyDealMilestones()
  for (const field of DEAL_MILESTONE_FIELDS) {
    next[field.id] = normalizeDealCalendarDate(raw[field.id])
  }
  return next
}

export function dealMilestonePatchFrom(payload = {}) {
  const patch = {}
  for (const { id } of DEAL_MILESTONE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, id)) {
      patch[id] = normalizeDealCalendarDate(payload[id])
    }
  }
  return patch
}

export function applyDealMilestonePatch(deal, patch = {}) {
  if (!deal || typeof deal !== 'object') return deal
  const next = dealMilestonePatchFrom(patch)
  for (const [id, value] of Object.entries(next)) {
    deal[id] = value
  }
  return deal
}

export function formatDealCalendarDate(value) {
  const iso = normalizeDealCalendarDate(value)
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  return `${day}-${month}-${year}`
}

export function filledDealMilestones(deal) {
  return DEAL_MILESTONE_FIELDS.filter((field) => deal?.[field.id]).map((field) => ({
    ...field,
    value: deal[field.id],
    display: formatDealCalendarDate(deal[field.id]),
  }))
}
