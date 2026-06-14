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

/** Incoterms 2020 — common freight RFQ options. */
export const INCOTERM_OPTIONS = [
  { id: '', label: 'Select incoterm' },
  { id: 'EXW', label: 'EXW — Ex Works' },
  { id: 'FCA', label: 'FCA — Free Carrier' },
  { id: 'FAS', label: 'FAS — Free Alongside Ship' },
  { id: 'FOB', label: 'FOB — Free on Board' },
  { id: 'CFR', label: 'CFR — Cost and Freight' },
  { id: 'CIF', label: 'CIF — Cost, Insurance & Freight' },
  { id: 'CPT', label: 'CPT — Carriage Paid To' },
  { id: 'CIP', label: 'CIP — Carriage & Insurance Paid To' },
  { id: 'DAP', label: 'DAP — Delivered at Place' },
  { id: 'DPU', label: 'DPU — Delivered at Place Unloaded' },
  { id: 'DDP', label: 'DDP — Delivered Duty Paid' },
]

export const INCOTERM_IDS = new Set(INCOTERM_OPTIONS.map((o) => o.id).filter(Boolean))

/** How this deal opportunity is structured — drives which RFQ fields appear. */
export const FREIGHT_CUSTOMER_TYPES = [
  {
    id: 'spot_rfq',
    label: 'Spot RFQ',
    shortLabel: 'RFQ',
    description: 'Per-shipment quote — lanes, weight, and cargo details',
  },
  {
    id: 'courier',
    label: 'Courier contract',
    shortLabel: 'Courier',
    description: 'Fixed volume and slab rates',
  },
]

export const FREIGHT_CUSTOMER_TYPE_IDS = new Set(FREIGHT_CUSTOMER_TYPES.map((t) => t.id))

export const COURIER_DESTINATION_OPTIONS = [
  { id: 'usa', label: 'USA' },
  { id: 'uk', label: 'United Kingdom' },
  { id: 'canada', label: 'Canada' },
  { id: 'australia', label: 'Australia' },
  { id: 'uae', label: 'UAE' },
  { id: 'eu', label: 'Europe (EU)' },
  { id: 'singapore', label: 'Singapore' },
  { id: 'other', label: 'Other destinations' },
]

export const COURIER_DESTINATION_IDS = new Set(COURIER_DESTINATION_OPTIONS.map((o) => o.id))

export const WEIGHT_SLAB_OPTIONS = [
  { id: '', label: 'Select weight slab' },
  { id: '0_500g', label: '0 – 500 g' },
  { id: '500g_1kg', label: '500 g – 1 kg' },
  { id: '1_2kg', label: '1 – 2 kg' },
  { id: '2_5kg', label: '2 – 5 kg' },
  { id: '5_10kg', label: '5 – 10 kg' },
  { id: '10_20kg', label: '10 – 20 kg' },
  { id: '20kg_plus', label: '20 kg+' },
  { id: 'custom', label: 'Custom slab' },
]

export const WEIGHT_SLAB_IDS = new Set(WEIGHT_SLAB_OPTIONS.map((o) => o.id).filter(Boolean))

export function getFreightCustomerTypeMeta(type) {
  if (type === 'mixed') {
    return { id: 'mixed', label: 'Mixed', shortLabel: 'Mixed', description: '' }
  }
  return FREIGHT_CUSTOMER_TYPES.find((t) => t.id === type) || FREIGHT_CUSTOMER_TYPES[0]
}

export function showsSpotRfqFields(type) {
  return type === 'spot_rfq' || type === 'mixed'
}

export function showsCourierFields(type) {
  return type === 'courier' || type === 'mixed'
}

export function emptyCourierProfile() {
  return {
    destinationCountries: [],
    weeklyShipments: null,
    weeklyWeightKg: null,
    avgShipmentWeightKg: null,
    targetRatePerKg: null,
    weightSlab: '',
    weightSlabNote: '',
    contractNotes: '',
  }
}

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
    customerType: 'spot_rfq',
    invoiceAmount: null,
    rfqDetails: '',
    incoterm: '',
    commodityType: '',
    hsnCode: '',
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
    courier: emptyCourierProfile(),
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
