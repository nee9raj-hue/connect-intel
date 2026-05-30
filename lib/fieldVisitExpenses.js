/** Field visit travel & expense helpers (shared client + server). */

export const TRAVEL_MODES = [
  { id: 'bike', label: 'Bike' },
  { id: 'car', label: 'Car' },
  { id: 'cab', label: 'Cab (actual amount)' },
  { id: 'other', label: 'Other' },
]

export const DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS = {
  bikeRatePerKm: 4,
  carRatePerKm: 10,
  defaultStartLocation: '',
  currency: 'INR',
}

export function mergeFieldVisitExpenseSettings(orgSettings) {
  const raw = orgSettings && typeof orgSettings === 'object' ? orgSettings : {}
  return {
    ...DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS,
    bikeRatePerKm: clampRate(raw.bikeRatePerKm, DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS.bikeRatePerKm),
    carRatePerKm: clampRate(raw.carRatePerKm, DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS.carRatePerKm),
    defaultStartLocation: String(raw.defaultStartLocation || '').trim().slice(0, 300),
    currency: String(raw.currency || 'INR').slice(0, 8) || 'INR',
  }
}

function clampRate(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(n, 9999)
}

export function buildLeadDestinationLabel(lead) {
  const parts = []
  const company = String(lead?.company || '').trim()
  if (company) parts.push(company)
  const city = String(lead?.city || '').trim()
  const state = String(lead?.state || '').trim()
  const loc = String(lead?.location || '').trim()
  if (city) parts.push(city)
  else if (loc) parts.push(loc.split(',')[0]?.trim())
  if (state && !parts.some((p) => p.toLowerCase() === state.toLowerCase())) parts.push(state)
  return parts.filter(Boolean).join(', ') || 'Customer location'
}

export function computeTravelClaimAmount(travel, settings = DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS) {
  if (!travel || typeof travel !== 'object') return 0
  const merged = mergeFieldVisitExpenseSettings(settings)
  const mode = String(travel.mode || '').toLowerCase()
  if (mode === 'cab') return roundMoney(Number(travel.cabAmount) || 0)
  if (mode === 'other') return roundMoney(Number(travel.claimAmount) || 0)
  const km = Number(travel.distanceKm)
  if (!Number.isFinite(km) || km <= 0) return 0
  const rate = mode === 'bike' ? merged.bikeRatePerKm : merged.carRatePerKm
  return roundMoney(km * rate)
}

function roundMoney(n) {
  return Math.round(n * 100) / 100
}

export function normalizeVisitTravelPayload(raw, settings = DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS) {
  const merged = mergeFieldVisitExpenseSettings(settings)
  const mode = TRAVEL_MODES.some((m) => m.id === raw?.mode) ? raw.mode : 'car'
  const distanceKm = Math.max(0, Number(raw?.distanceKm) || 0)
  const cabAmount = Math.max(0, Number(raw?.cabAmount) || 0)
  const manualClaim = Math.max(0, Number(raw?.claimAmount) || 0)
  const travel = {
    startLabel: String(raw?.startLabel || merged.defaultStartLocation || '').trim().slice(0, 300),
    endLabel: String(raw?.endLabel || '').trim().slice(0, 300),
    mode,
    distanceKm: mode === 'cab' || mode === 'other' ? 0 : roundMoney(distanceKm),
    distanceSource:
      raw?.distanceSource === 'google' ||
      raw?.distanceSource === 'osrm' ||
      raw?.distanceSource === 'estimated' ||
      raw?.distanceSource === 'manual'
        ? raw.distanceSource
        : 'manual',
    cabAmount: mode === 'cab' ? roundMoney(cabAmount) : 0,
    claimAmount: 0,
    ratePerKm:
      mode === 'bike' ? merged.bikeRatePerKm : mode === 'car' ? merged.carRatePerKm : 0,
    currency: merged.currency,
    visitAt: raw?.visitAt || null,
  }
  travel.claimAmount =
    mode === 'other' ? manualClaim : computeTravelClaimAmount(travel, merged)
  if (raw?.suggestedDistanceKm != null && Number.isFinite(Number(raw.suggestedDistanceKm))) {
    travel.suggestedDistanceKm = roundMoney(Number(raw.suggestedDistanceKm))
  }
  return travel
}

/** Build form defaults from a recorded field-visit meeting. */
export function fieldVisitMeetingToFormState(meeting, settings = DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS) {
  const t = meeting?.visitTravel || {}
  return {
    meetingId: meeting?.id || '',
    visitAt: t.visitAt || meeting?.actualVisitAt || meeting?.visitRecordedAt || meeting?.scheduledAt || '',
    title: meeting?.title || '',
    outcome: meeting?.visitOutcome || 'completed',
    notes: meeting?.visitNotes || '',
    startLabel: t.startLabel || settings.defaultStartLocation || '',
    endLabel: t.endLabel || meeting?.location || '',
    travelMode: t.mode || 'car',
    distanceKm: t.distanceKm != null ? String(t.distanceKm) : '',
    cabAmount: t.cabAmount != null ? String(t.cabAmount) : '',
    suggestedDistanceKm: t.suggestedDistanceKm != null ? t.suggestedDistanceKm : null,
    distanceSource: t.distanceSource || 'manual',
  }
}

export function travelModeLabel(mode) {
  return TRAVEL_MODES.find((m) => m.id === mode)?.label || mode || '—'
}

export function formatInr(amount) {
  const n = Number(amount) || 0
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}
