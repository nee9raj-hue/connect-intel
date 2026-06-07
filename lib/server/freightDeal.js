import {
  CARGO_READINESS_OPTIONS,
  COURIER_DESTINATION_IDS,
  emptyCourierProfile,
  emptyFreightBox,
  emptyFreightRfq,
  FREIGHT_CUSTOMER_TYPE_IDS,
  INCOTERM_IDS,
  TRANSPORT_MODE_OPTIONS,
  WEIGHT_SLAB_IDS,
} from '../freightDeal.js'

const READINESS_IDS = new Set(CARGO_READINESS_OPTIONS.map((o) => o.id))
const TRANSPORT_IDS = new Set(TRANSPORT_MODE_OPTIONS.map((o) => o.id))

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function normalizeBox(row) {
  if (!row || typeof row !== 'object') return emptyFreightBox()
  return {
    lengthCm: numOrNull(row.lengthCm),
    widthCm: numOrNull(row.widthCm),
    heightCm: numOrNull(row.heightCm),
    quantity: Math.max(1, Math.floor(Number(row.quantity) || 1)),
  }
}

function normalizeCourierProfile(raw) {
  const base = emptyCourierProfile()
  if (!raw || typeof raw !== 'object') return base
  const countries = Array.isArray(raw.destinationCountries)
    ? [...new Set(raw.destinationCountries.map((c) => String(c).trim()).filter((c) => COURIER_DESTINATION_IDS.has(c)))]
    : []
  const slab = WEIGHT_SLAB_IDS.has(String(raw.weightSlab || '')) ? String(raw.weightSlab) : ''
  return {
    destinationCountries: countries.slice(0, 12),
    weeklyShipments: numOrNull(raw.weeklyShipments),
    weeklyWeightKg: numOrNull(raw.weeklyWeightKg),
    avgShipmentWeightKg: numOrNull(raw.avgShipmentWeightKg),
    targetRatePerKg: numOrNull(raw.targetRatePerKg),
    weightSlab: slab,
    weightSlabNote: String(raw.weightSlabNote || '').slice(0, 120),
    contractNotes: String(raw.contractNotes || '').slice(0, 2000),
  }
}

function courierHasData(courier) {
  if (!courier) return false
  return (
    courier.destinationCountries?.length > 0 ||
    courier.weeklyShipments != null ||
    courier.weeklyWeightKg != null ||
    courier.avgShipmentWeightKg != null ||
    courier.targetRatePerKg != null ||
    courier.weightSlab ||
    courier.weightSlabNote ||
    courier.contractNotes
  )
}

export function normalizeFreightRfq(raw) {
  if (!raw || typeof raw !== 'object') return null
  const base = emptyFreightRfq()
  const boxes = Array.isArray(raw.boxes) && raw.boxes.length
    ? raw.boxes.map(normalizeBox).slice(0, 20)
    : [emptyFreightBox()]
  const customerType = FREIGHT_CUSTOMER_TYPE_IDS.has(raw.customerType) ? raw.customerType : base.customerType
  const courier = normalizeCourierProfile(raw.courier)
  const out = {
    customerType,
    invoiceAmount: numOrNull(raw.invoiceAmount),
    rfqDetails: String(raw.rfqDetails || '').slice(0, 4000),
    incoterm: INCOTERM_IDS.has(String(raw.incoterm || '').toUpperCase())
      ? String(raw.incoterm).toUpperCase()
      : '',
    commodityType: String(raw.commodityType || '').trim().slice(0, 200),
    hsnCode: String(raw.hsnCode || '').trim().replace(/\s+/g, '').slice(0, 20),
    transportMode: TRANSPORT_IDS.has(raw.transportMode) ? raw.transportMode : '',
    pickupZip: String(raw.pickupZip || '').trim().slice(0, 20),
    pickupCity: String(raw.pickupCity || '').trim().slice(0, 120),
    pickupState: String(raw.pickupState || '').trim().slice(0, 120),
    pickupCountry: String(raw.pickupCountry || 'India').trim().slice(0, 80) || 'India',
    deliveryZip: String(raw.deliveryZip || '').trim().slice(0, 20),
    deliveryCity: String(raw.deliveryCity || '').trim().slice(0, 120),
    deliveryState: String(raw.deliveryState || '').trim().slice(0, 120),
    deliveryCountry: String(raw.deliveryCountry || '').trim().slice(0, 80),
    grossWeightKg: numOrNull(raw.grossWeightKg),
    boxCount: numOrNull(raw.boxCount),
    boxes,
    cargoReadiness: READINESS_IDS.has(raw.cargoReadiness) ? raw.cargoReadiness : base.cargoReadiness,
    cargoReadinessNote: String(raw.cargoReadinessNote || '').slice(0, 500),
    courier,
  }
  const hasData =
    customerType !== 'spot_rfq' ||
    out.invoiceAmount != null ||
    out.rfqDetails ||
    out.incoterm ||
    out.commodityType ||
    out.hsnCode ||
    out.transportMode ||
    out.pickupZip ||
    out.deliveryZip ||
    out.grossWeightKg != null ||
    out.boxCount != null ||
    boxes.some((b) => b.lengthCm || b.widthCm || b.heightCm) ||
    courierHasData(courier)
  return hasData ? out : null
}

export function mergeFreightRfq(existing, patch) {
  if (!patch || typeof patch !== 'object') return normalizeFreightRfq(existing)
  const merged = { ...(existing || emptyFreightRfq()), ...patch }
  if (patch.boxes) merged.boxes = patch.boxes
  if (patch.courier && typeof patch.courier === 'object') {
    merged.courier = { ...(existing?.courier || emptyCourierProfile()), ...patch.courier }
  }
  return normalizeFreightRfq(merged)
}
