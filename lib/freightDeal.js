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

/** Volumetric (dimensional) weight divisor — cm³ per kg. */
export const VOLUMETRIC_DIVISOR_OPTIONS = [
  { id: 5000, label: '5,000' },
  { id: 6000, label: '6,000' },
]

export const VOLUMETRIC_DIVISOR_IDS = new Set(VOLUMETRIC_DIVISOR_OPTIONS.map((o) => o.id))

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

export function emptyOriginClearance() {
  return {
    broker: '',
    chargesInr: null,
    notes: '',
  }
}

/** Destination customs clearance — optional (`applicable` when required). */
export function emptyDestinationClearance() {
  return {
    applicable: false,
    broker: '',
    chargesInr: null,
    notes: '',
  }
}

export function normalizeVolumetricDivisor(value) {
  const n = Number(value)
  return n === 6000 ? 6000 : 5000
}

/** CBM from box dimensions in cm: (L × W × H × qty) ÷ 1,000,000. */
export const CBM_FROM_CM_DIVISOR = 1_000_000

export function isOceanTransportMode(mode) {
  return String(mode || '') === 'ocean'
}

export function freightMeasureUnit(transportMode) {
  return isOceanTransportMode(transportMode) ? 'cbm' : 'kg'
}

export function freightRateUnitLabel(transportMode) {
  return isOceanTransportMode(transportMode) ? '₹/CBM' : '₹'
}

export function freightGrossFieldLabel(transportMode) {
  return isOceanTransportMode(transportMode) ? 'Gross CBM' : 'Gross weight (kg)'
}

export function formatFreightMeasure(value, transportMode) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return isOceanTransportMode(transportMode) ? `${n} CBM` : `${n} kg`
}

/** CBM for one box line from cm dimensions. */
export function boxCbm(box) {
  const l = Number(box?.lengthCm)
  const w = Number(box?.widthCm)
  const h = Number(box?.heightCm)
  const qty = Math.max(1, Math.floor(Number(box?.quantity) || 1))
  if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(h) || l <= 0 || w <= 0 || h <= 0) {
    return 0
  }
  return (l * w * h * qty) / CBM_FROM_CM_DIVISOR
}

export function totalCbm(boxes) {
  return (boxes || []).reduce((sum, box) => sum + boxCbm(box), 0)
}

function roundMeasure(n, { unit = 'kg' } = {}) {
  if (!Number.isFinite(n) || n <= 0) return null
  const decimals = unit === 'cbm' ? 3 : 2
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

/** Volumetric weight for one box line (L×W×H cm, qty) ÷ divisor. */
export function boxVolumetricWeightKg(box, divisor = 5000) {
  const l = Number(box?.lengthCm)
  const w = Number(box?.widthCm)
  const h = Number(box?.heightCm)
  const qty = Math.max(1, Math.floor(Number(box?.quantity) || 1))
  if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(h) || l <= 0 || w <= 0 || h <= 0) {
    return 0
  }
  const d = normalizeVolumetricDivisor(divisor)
  return (l * w * h * qty) / d
}

export function totalVolumetricWeightKg(boxes, divisor = 5000) {
  return (boxes || []).reduce((sum, box) => sum + boxVolumetricWeightKg(box, divisor), 0)
}

function roundWeightKg(n) {
  return roundMeasure(n, { unit: 'kg' })
}

/** Air: chargeable kg = max(gross, volumetric). Ocean: chargeable CBM = max(declared, from dimensions). */
export function freightChargeableMeasure({
  transportMode,
  grossWeightKg,
  boxes,
  volumetricDivisor = 5000,
} = {}) {
  const unit = freightMeasureUnit(transportMode)
  const gross = Number(grossWeightKg)
  const grossValue = Number.isFinite(gross) && gross > 0 ? roundMeasure(gross, { unit }) : null

  if (unit === 'cbm') {
    const dimensionalValue = roundMeasure(totalCbm(boxes), { unit: 'cbm' })
    const chargeable = Math.max(dimensionalValue || 0, grossValue || 0)
    const chargeableValue = chargeable > 0 ? roundMeasure(chargeable, { unit: 'cbm' }) : null
    return {
      unit: 'cbm',
      dimensionalValue,
      grossValue,
      chargeableValue,
      volumetricWeightKg: null,
      grossWeightKg: null,
      chargeableWeightKg: null,
    }
  }

  const dimensionalValue = roundWeightKg(totalVolumetricWeightKg(boxes, volumetricDivisor))
  const chargeable = Math.max(dimensionalValue || 0, grossValue || 0)
  const chargeableValue = chargeable > 0 ? roundWeightKg(chargeable) : null
  return {
    unit: 'kg',
    dimensionalValue,
    grossValue,
    chargeableValue,
    volumetricWeightKg: dimensionalValue,
    grossWeightKg: grossValue,
    chargeableWeightKg: chargeableValue,
  }
}

/** Chargeable weight = max(gross, volumetric) — air modes only. */
export function freightChargeableWeightKg({ grossWeightKg, boxes, volumetricDivisor = 5000, transportMode } = {}) {
  const result = freightChargeableMeasure({ transportMode, grossWeightKg, boxes, volumetricDivisor })
  if (result.unit === 'cbm') {
    return {
      volumetricWeightKg: null,
      grossWeightKg: result.grossValue,
      chargeableWeightKg: null,
    }
  }
  return {
    volumetricWeightKg: result.dimensionalValue,
    grossWeightKg: result.grossValue,
    chargeableWeightKg: result.chargeableValue,
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
    volumetricDivisor: 5000,
    originClearance: emptyOriginClearance(),
    destinationClearance: emptyDestinationClearance(),
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
