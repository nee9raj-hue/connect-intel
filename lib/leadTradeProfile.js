/** Rep-filled trade profile on a pipeline lead — used for service offering, not ERP history. */

const MAX_TAGS = 24
const MAX_TAG_LEN = 80
const MAX_SIZE_LEN = 80

export const TRADE_PROFILE_SALES_CHANNELS = [
  { id: 'fba', label: 'FBA' },
  { id: 'b2b', label: 'B2B' },
]

export const TRADE_PROFILE_TRANSPORT_MODES = [
  { id: 'air', label: 'Air' },
  { id: 'ocean', label: 'Ocean' },
]

export const TRADE_PROFILE_CARGO_CLASSES = [
  { id: 'commercial', label: 'Commercial' },
  { id: 'courier', label: 'Courier' },
]

export const TRADE_PROFILE_ORIGIN_FOOTPRINT = [
  { id: 'single', label: 'Single location' },
  { id: 'multi', label: 'Multi-location' },
]

export const TRADE_PROFILE_COMMODITY_SUGGESTIONS = [
  'Apparel',
  'Electronics',
  'Home & kitchen',
  'Beauty',
  'Auto parts',
  'Pharma',
  'Industrial',
  'General cargo',
]

export const TRADE_PROFILE_MARKET_SUGGESTIONS = [
  'United States',
  'United Kingdom',
  'Australia',
  'UAE',
  'Germany',
  'Canada',
  'Netherlands',
  'Singapore',
]

const CHANNEL_IDS = new Set(TRADE_PROFILE_SALES_CHANNELS.map((r) => r.id))
const MODE_IDS = new Set(TRADE_PROFILE_TRANSPORT_MODES.map((r) => r.id))
const CARGO_IDS = new Set(TRADE_PROFILE_CARGO_CLASSES.map((r) => r.id))
const FOOTPRINT_IDS = new Set(TRADE_PROFILE_ORIGIN_FOOTPRINT.map((r) => r.id))

function cleanText(value, max = MAX_TAG_LEN) {
  const s = String(value || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  return s.slice(0, max)
}

function uniqueTags(list) {
  const seen = new Set()
  const out = []
  for (const raw of list || []) {
    const tag = cleanText(raw)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

function uniqueIds(list, allowed) {
  const out = []
  const seen = new Set()
  for (const raw of list || []) {
    const id = String(raw || '').trim().toLowerCase()
    if (!allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function labelFor(id, defs) {
  return defs.find((row) => row.id === id)?.label || id
}

export function emptyTradeProfile() {
  return {
    commodities: [],
    salesChannels: [],
    transportModes: [],
    cargoClasses: [],
    typicalShipmentSize: '',
    originFootprint: null,
    splitDeliveries: null,
    destinationMarkets: [],
    laneCadence: [],
    updatedAt: null,
    updatedByUserId: null,
    updatedByName: null,
  }
}

export function normalizeTradeProfile(raw, { actor } = {}) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const destinationMarkets = uniqueTags(src.destinationMarkets || src.countries || [])
  const cadence = []
  const cadenceSeen = new Set()
  for (const row of src.laneCadence || src.shipmentFrequency || []) {
    if (!row || typeof row !== 'object') continue
    const market = cleanText(row.market || row.country)
    if (!market) continue
    const key = market.toLowerCase()
    if (cadenceSeen.has(key)) continue
    cadenceSeen.add(key)
    const n = Number(row.shipmentsPerMonth ?? row.perMonth ?? row.frequency)
    cadence.push({
      market,
      shipmentsPerMonth: Number.isFinite(n) && n > 0 ? Math.min(999, Math.round(n)) : null,
    })
    if (cadence.length >= MAX_TAGS) break
  }

  const splitRaw = src.splitDeliveries ?? src.multiLocationDeliveries
  let splitDeliveries = null
  if (splitRaw === true || splitRaw === false) splitDeliveries = splitRaw
  else if (splitRaw === 'yes' || splitRaw === 'true') splitDeliveries = true
  else if (splitRaw === 'no' || splitRaw === 'false') splitDeliveries = false

  const footprint = String(src.originFootprint || '').trim().toLowerCase()
  const profile = {
    commodities: uniqueTags(src.commodities),
    salesChannels: uniqueIds(src.salesChannels || src.channels, CHANNEL_IDS),
    transportModes: uniqueIds(src.transportModes || src.shipmentTypes, MODE_IDS),
    cargoClasses: uniqueIds(src.cargoClasses || src.shipmentClass, CARGO_IDS),
    typicalShipmentSize: cleanText(src.typicalShipmentSize || src.averageShipmentSize, MAX_SIZE_LEN),
    originFootprint: FOOTPRINT_IDS.has(footprint) ? footprint : null,
    splitDeliveries,
    destinationMarkets,
    laneCadence: cadence,
    updatedAt: src.updatedAt || null,
    updatedByUserId: src.updatedByUserId || null,
    updatedByName: src.updatedByName || null,
  }

  if (actor?.userId) {
    profile.updatedAt = new Date().toISOString()
    profile.updatedByUserId = actor.userId
    profile.updatedByName = actor.name || actor.email || null
  }
  return profile
}

export function hasTradeProfileDisplayData(raw) {
  const p = normalizeTradeProfile(raw)
  return Boolean(
    p.commodities.length ||
      p.salesChannels.length ||
      p.transportModes.length ||
      p.cargoClasses.length ||
      p.typicalShipmentSize ||
      p.originFootprint ||
      p.splitDeliveries != null ||
      p.destinationMarkets.length ||
      p.laneCadence.some((row) => row.shipmentsPerMonth)
  )
}

export function getLeadTradeProfile(leadOrEntry) {
  if (!leadOrEntry) return emptyTradeProfile()
  return normalizeTradeProfile(
    leadOrEntry.tradeProfile || leadOrEntry.lead?.tradeProfile || null
  )
}

export function formatChoiceLabels(ids, defs) {
  return (ids || []).map((id) => labelFor(id, defs)).filter(Boolean)
}

export function formatLaneCadence(row) {
  if (!row?.market) return ''
  if (row.shipmentsPerMonth == null) return row.market
  const n = row.shipmentsPerMonth
  return `${row.market} · ${n} / month`
}
