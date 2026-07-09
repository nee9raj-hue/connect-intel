import { normalizeFreightRfq } from '../freightDeal.js'

/** Detect pasted WhatsApp / email RFQ text (not a short question). */
export function looksLikeRfqPaste(text) {
  const t = String(text || '').trim()
  if (t.length < 24) return false
  if (/^(what|how|who|when|where|why|can you|tell me|research)\b/i.test(t) && t.length < 120) {
    return false
  }
  const lines = t.split(/\n+/).filter((l) => l.trim().length > 0)
  const hasFreightSignal = RFQ_SIGNAL_RE.test(t)
  const hasNumbers = /\d/.test(t)
  const multiLine = lines.length >= 2
  const longSingle = t.length >= 80 && hasFreightSignal
  return hasFreightSignal && hasNumbers && (multiLine || longSingle)
}

export const RFQ_SIGNAL_RE =
  /\b(rfq|quotation|quote me|need quote|shipment|shipping|cargo|carton|cartons|cbm|container|incoterm|\bfob\b|\bcif\b|\bddp\b|\bexw\b|\bfca\b|\bcfr\b|hsn|gross weight|chargeable|volumetric|pincode|pin code|pickup|delivery|port of|air freight|ocean freight|sea freight)\b/i

export const LOGISTICS_INTEL_RE =
  /\b(documents?|documentation|customs?|clearance|iec\b|ad code|cha\b|dgft|fssai|export license|import license|duty|tariff|hs code|hsn|bill of lading|shipping bill|packing list|certificate of origin|fumigation|phytosanitary|who is|customs rule)\b/i

export const MESSAGING_COPILOT_RE =
  /\b(campaign|bulk email|email send|open rate|click rate|retry failed|failed sends?|non.?openers|opened but|didn't reply|did not reply|messaging)\b/i

function mapTransportMode(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
  if (!v) return ''
  if ((v.includes('air') && v.includes('ocean')) || v.includes('air + ocean')) return 'air_ocean'
  if (v.includes('air')) return 'air'
  if (v.includes('ocean') || v.includes('sea') || v.includes('fcl') || v.includes('lcl')) return 'ocean'
  return ''
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Map LogiCopilot-style JSON (or Gemini parse output) into freight RFQ shape.
 */
export function mapLogiCopilotJsonToFreightRfq(parsed, rawMessage = '') {
  if (!parsed || typeof parsed !== 'object') return null

  const dims = parsed.dimensions && typeof parsed.dimensions === 'object' ? parsed.dimensions : {}
  const boxCount = numOrNull(parsed.box_count ?? parsed.boxCount)
  const length = numOrNull(dims.length ?? dims.lengthCm)
  const width = numOrNull(dims.width ?? dims.widthCm)
  const height = numOrNull(dims.height ?? dims.heightCm)

  const boxes = []
  if (length || width || height) {
    boxes.push({
      lengthCm: length,
      widthCm: width,
      heightCm: height,
      quantity: Math.max(1, Math.floor(boxCount || 1)),
    })
  }

  const draft = {
    customerType: 'spot_rfq',
    commodityType: String(parsed.commodity || parsed.commodityType || '').trim(),
    hsnCode: String(parsed.hsn_code || parsed.hsnCode || '')
      .trim()
      .replace(/\s+/g, ''),
    transportMode: mapTransportMode(parsed.transport_mode || parsed.transportMode),
    incoterm: String(parsed.incoterm || '')
      .trim()
      .toUpperCase()
      .slice(0, 3),
    grossWeightKg: numOrNull(parsed.gross_weight_kg ?? parsed.grossWeightKg),
    boxCount,
    pickupCity: String(parsed.origin_city || parsed.pickupCity || '').trim(),
    pickupZip: String(parsed.origin_pincode || parsed.pickupZip || '').trim(),
    pickupCountry: String(parsed.origin_country || parsed.pickupCountry || 'India').trim() || 'India',
    deliveryCity: String(parsed.destination_city || parsed.deliveryCity || '').trim(),
    deliveryCountry: String(parsed.destination_country || parsed.deliveryCountry || '').trim(),
    deliveryZip: String(parsed.destination_zip || parsed.deliveryZip || '').trim(),
    boxes: boxes.length ? boxes : [{ lengthCm: null, widthCm: null, heightCm: null, quantity: 1 }],
    rfqDetails: String(rawMessage || '')
      .trim()
      .slice(0, 2000),
  }

  return normalizeFreightRfq(draft)
}

export function formatRfqSummary(freight) {
  if (!freight) return 'No fields extracted.'
  const lines = []
  if (freight.commodityType) lines.push(`- **Commodity:** ${freight.commodityType}`)
  if (freight.hsnCode) lines.push(`- **HSN:** ${freight.hsnCode}`)
  if (freight.transportMode) lines.push(`- **Mode:** ${freight.transportMode.replace('_', ' + ')}`)
  if (freight.incoterm) lines.push(`- **Incoterm:** ${freight.incoterm}`)
  if (freight.grossWeightKg != null) lines.push(`- **Gross weight:** ${freight.grossWeightKg} kg`)
  if (freight.boxCount != null) lines.push(`- **Cartons:** ${freight.boxCount}`)
  const box = freight.boxes?.[0]
  if (box?.lengthCm || box?.widthCm || box?.heightCm) {
    lines.push(
      `- **Dimensions (cm):** ${box.lengthCm || '—'} × ${box.widthCm || '—'} × ${box.heightCm || '—'}`
    )
  }
  const origin = [freight.pickupCity, freight.pickupZip, freight.pickupCountry].filter(Boolean).join(', ')
  if (origin) lines.push(`- **Origin:** ${origin}`)
  const dest = [freight.deliveryCity, freight.deliveryCountry].filter(Boolean).join(', ')
  if (dest) lines.push(`- **Destination:** ${dest}`)
  return lines.length ? lines.join('\n') : 'No fields extracted — add commodity, weight, or lane details.'
}
