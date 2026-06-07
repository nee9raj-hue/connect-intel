/** Freight / shipping RFQ fields on CRM deals (Xindus and opt-in orgs). */

export const CARGO_READINESS_OPTIONS = [
  { id: 'ready', label: 'Ready to ship' },
  { id: 'within_7_days', label: 'Ready within 7 days' },
  { id: 'within_30_days', label: 'Ready within 30 days' },
  { id: 'not_ready', label: 'Not ready yet' },
  { id: 'custom', label: 'Other (see notes)' },
]

export const TRANSPORT_MODE_OPTIONS = [
  { id: 'air', label: 'Air' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'air_ocean', label: 'Air + Ocean' },
]

/** Freight shipment deal pipeline — separate from contact/lead status (New, Contacted, etc.). */
export const FREIGHT_DEAL_STAGES = [
  { id: 'rfq', label: 'RFQ', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { id: 'quoted', label: 'Quoted', color: 'bg-sky-50 text-sky-800 border-sky-200' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'booked', label: 'Booked', color: 'bg-teal-50 text-teal-800 border-teal-200' },
  { id: 'won', label: 'Won', color: 'bg-[#fff4ee] text-[#FF773D] border-[#ffd4b8]' },
  { id: 'lost', label: 'Lost', color: 'bg-gray-100 text-gray-500 border-gray-200' },
]

export const FREIGHT_DEAL_STAGE_IDS = FREIGHT_DEAL_STAGES.map((s) => s.id)

/** Older deals used lead-style stages — map for counts and display. */
export const LEGACY_FREIGHT_DEAL_STAGE_MAP = {
  new: 'rfq',
  contacted: 'quoted',
  follow_up: 'negotiation',
  replied: 'negotiation',
}

export function normalizeFreightDealStage(stage) {
  const id = String(stage || 'rfq')
  return LEGACY_FREIGHT_DEAL_STAGE_MAP[id] || id
}

export function getFreightDealStageMeta(stage) {
  const id = normalizeFreightDealStage(stage)
  return FREIGHT_DEAL_STAGES.find((s) => s.id === id) || FREIGHT_DEAL_STAGES[0]
}

export function isFreightDealStageClosed(stage) {
  const id = normalizeFreightDealStage(stage)
  return id === 'won' || id === 'lost'
}

export function emptyFreightRfq() {
  return {
    rfqDetails: '',
    transportMode: '',
    pickupZip: '',
    pickupCity: '',
    pickupState: '',
    pickupCountry: 'India',
    deliveryZip: '',
    deliveryCity: '',
    deliveryState: '',
    deliveryCountry: '',
    grossWeightKg: null,
    boxCount: null,
    boxes: [{ lengthCm: null, widthCm: null, heightCm: null, quantity: 1 }],
    cargoReadiness: 'ready',
    cargoReadinessNote: '',
  }
}

export function emptyFreightBox() {
  return { lengthCm: null, widthCm: null, heightCm: null, quantity: 1 }
}

/** Whether this org/user gets freight RFQ fields on deals (others use standard deals). */
export function isFreightDealOrg(orgOrUser, user = null) {
  const u = user || orgOrUser
  const org =
    orgOrUser &&
    typeof orgOrUser === 'object' &&
    (orgOrUser.workspacePreset != null || orgOrUser.workspaceFeatures != null) &&
    !orgOrUser.email
      ? orgOrUser
      : null

  if (u?.workspaceFeatures?.freightDealRfq === true) return true
  if (u?.workspaceFeatures?.freightDealRfq === false) return false
  if (org?.workspaceFeatures?.freightDealRfq === true) return true
  if (org?.workspaceFeatures?.freightDealRfq === false) return false

  const name = String(org?.name || u?.organizationName || '').toLowerCase()
  if (name.includes('xindus')) return true
  const email = String(u?.email || '').toLowerCase()
  if (email.endsWith('@xindus.net')) return true
  return false
}
