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

export const DEAL_QUERY_FIELDS = DEAL_MILESTONE_FIELDS.filter(
  (field) => field.id === 'queryReceivedOn' || field.id === 'ratesQuotedOn'
)

export const DEAL_OUTCOME_OPTIONS = [
  { id: '', label: 'Not yet' },
  { id: 'won', label: 'Won', dateId: 'wonOn' },
  { id: 'booked', label: 'Booked', dateId: 'bookedOn' },
  { id: 'lost', label: 'Lost', dateId: 'lostOn' },
]

export function dealOutcomeOptions({ includeBooked = true } = {}) {
  return DEAL_OUTCOME_OPTIONS.filter((option) => includeBooked || option.id !== 'booked')
}

export function resolveDealOutcome(deal = {}) {
  const stage = String(deal.stage || '').toLowerCase()
  if (deal.lostOn || stage === 'lost') return 'lost'
  if (deal.bookedOn || stage === 'booked') return 'booked'
  if (deal.wonOn || stage === 'won') return 'won'
  return ''
}

export function dealOutcomeDateField(outcome) {
  const option = DEAL_OUTCOME_OPTIONS.find((row) => row.id === outcome)
  return option?.dateId || null
}

export function applyDealOutcome(values = {}, outcome, outcomeDate) {
  const next = pickDealMilestones(values)
  const date = normalizeDealCalendarDate(outcomeDate)
  const id = String(outcome || '')
  if (id === 'lost') {
    next.lostOn = date
    next.bookedOn = null
    next.wonOn = null
  } else if (id === 'booked') {
    next.bookedOn = date
    next.lostOn = null
  } else if (id === 'won') {
    next.wonOn = date
    next.bookedOn = null
    next.lostOn = null
  } else {
    next.bookedOn = null
    next.wonOn = null
    next.lostOn = null
  }
  return next
}

/** Dates used by range filters: customer dates when present, else empty (caller falls back to CRM log). */
export function dealDatesForRangeFilter(deal = {}, dateStages = []) {
  const row = deal?.deal && typeof deal.deal === 'object' ? deal.deal : deal
  const wanted = (dateStages || [])
    .map((stage) => String(stage || '').trim().toLowerCase())
    .filter((stage) => stage && stage !== 'all')

  const dateForStage = (stage) => {
    if (stage === 'booked') return row.bookedOn || row.wonOn || null
    if (stage === 'won') return row.wonOn || null
    if (stage === 'lost') return row.lostOn || null
    if (stage === 'quoted' || stage === 'negotiation' || stage === 'contacted' || stage === 'follow_up' || stage === 'replied') {
      return row.ratesQuotedOn || row.queryReceivedOn || null
    }
    if (stage === 'rfq' || stage === 'new') return row.queryReceivedOn || null
    return null
  }

  if (wanted.length === 1) {
    const one = dateForStage(wanted[0])
    return one ? [one] : []
  }
  if (wanted.length > 1) {
    return [...new Set(wanted.map(dateForStage).filter(Boolean))]
  }
  return [
    row.queryReceivedOn,
    row.ratesQuotedOn,
    row.bookedOn,
    row.wonOn,
    row.lostOn,
  ].filter(Boolean)
}

export function filledDealMilestones(deal) {
  return DEAL_MILESTONE_FIELDS.filter((field) => deal?.[field.id]).map((field) => ({
    ...field,
    value: deal[field.id],
    display: formatDealCalendarDate(deal[field.id]),
  }))
}
