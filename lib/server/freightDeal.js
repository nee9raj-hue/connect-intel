import { CARGO_READINESS_OPTIONS, emptyFreightBox, emptyFreightRfq } from '../freightDeal.js'

const READINESS_IDS = new Set(CARGO_READINESS_OPTIONS.map((o) => o.id))

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

export function normalizeFreightRfq(raw) {
  if (!raw || typeof raw !== 'object') return null
  const base = emptyFreightRfq()
  const boxes = Array.isArray(raw.boxes) && raw.boxes.length
    ? raw.boxes.map(normalizeBox).slice(0, 20)
    : [emptyFreightBox()]
  const out = {
    rfqDetails: String(raw.rfqDetails || '').slice(0, 4000),
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
  }
  const hasData =
    out.rfqDetails ||
    out.pickupZip ||
    out.deliveryZip ||
    out.grossWeightKg != null ||
    out.boxCount != null ||
    boxes.some((b) => b.lengthCm || b.widthCm || b.heightCm)
  return hasData ? out : null
}

export function mergeFreightRfq(existing, patch) {
  if (!patch || typeof patch !== 'object') return normalizeFreightRfq(existing)
  const merged = { ...(existing || emptyFreightRfq()), ...patch }
  if (patch.boxes) merged.boxes = patch.boxes
  return normalizeFreightRfq(merged)
}
