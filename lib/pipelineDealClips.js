import { formatDealCalendarDate } from './dealMilestones.js'

export const PIPELINE_DEAL_CLIP_DAYS = 30
const MAX_PIPELINE_DEAL_CLIPS = 12

function stampMs(value) {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

export function dealClipSortMs(deal) {
  if (!deal || typeof deal !== 'object') return 0
  return Math.max(
    0,
    stampMs(deal.updatedAt),
    stampMs(deal.createdAt),
    stampMs(deal.bookedOn),
    stampMs(deal.wonOn),
    stampMs(deal.lostOn),
    stampMs(deal.ratesQuotedOn),
    stampMs(deal.queryReceivedOn),
    stampMs(deal.expectedCloseDate)
  )
}

export function dealIsInClipWindow(deal, now = Date.now()) {
  const ms = dealClipSortMs(deal)
  if (!ms) return false
  const windowMs = PIPELINE_DEAL_CLIP_DAYS * 24 * 60 * 60 * 1000
  return now - ms <= windowMs && ms <= now + 24 * 60 * 60 * 1000
}

export function slimDealForPipelineClip(deal) {
  if (!deal || typeof deal !== 'object') return null
  const freight = deal.freight && typeof deal.freight === 'object' ? deal.freight : null
  return {
    id: deal.id || null,
    name: String(deal.name || 'Deal').slice(0, 120),
    stage: String(deal.stage || ''),
    amount: deal.amount ?? null,
    currency: deal.currency || null,
    createdAt: deal.createdAt || null,
    updatedAt: deal.updatedAt || null,
    queryReceivedOn: deal.queryReceivedOn || null,
    ratesQuotedOn: deal.ratesQuotedOn || null,
    bookedOn: deal.bookedOn || null,
    wonOn: deal.wonOn || null,
    lostOn: deal.lostOn || null,
    freight: freight
      ? {
          customerType: freight.customerType || '',
          transportMode: freight.transportMode || '',
          pickupCity: String(freight.pickupCity || '').slice(0, 40),
          deliveryCity: String(freight.deliveryCity || '').slice(0, 40),
          pickupZip: String(freight.pickupZip || '').slice(0, 12),
          deliveryZip: String(freight.deliveryZip || '').slice(0, 12),
          commodityType: String(freight.commodityType || '').slice(0, 40),
          incoterm: freight.incoterm || '',
          grossWeightKg: freight.grossWeightKg ?? null,
          boxCount: freight.boxCount ?? null,
        }
      : null,
  }
}

export function slimPipelineDealsForList(deals, now = Date.now()) {
  return (Array.isArray(deals) ? deals : [])
    .filter((deal) => dealIsInClipWindow(deal, now))
    .map(slimDealForPipelineClip)
    .filter(Boolean)
    .sort((a, b) => dealClipSortMs(b) - dealClipSortMs(a))
    .slice(0, MAX_PIPELINE_DEAL_CLIPS)
}

export function compactFreightClipLine(freight) {
  if (!freight || typeof freight !== 'object') return ''
  const parts = []
  if (freight.customerType && freight.customerType !== 'spot_rfq') {
    parts.push(freight.customerType === 'courier' ? 'Courier' : String(freight.customerType))
  }
  const from = [freight.pickupCity, freight.pickupZip].filter(Boolean).join(' ')
  const to = [freight.deliveryCity, freight.deliveryZip].filter(Boolean).join(' ')
  if (from || to) parts.push(`${from || '—'} → ${to || '—'}`)
  if (freight.incoterm) parts.push(freight.incoterm)
  if (freight.commodityType) parts.push(freight.commodityType)
  if (freight.transportMode === 'ocean') parts.push('Ocean')
  else if (freight.transportMode === 'air') parts.push('Air')
  else if (freight.transportMode === 'air_ocean') parts.push('Air + Ocean')
  else if (freight.transportMode) parts.push(String(freight.transportMode))
  if (freight.grossWeightKg != null && freight.grossWeightKg !== '') parts.push(`${freight.grossWeightKg}kg`)
  if (freight.boxCount != null && freight.boxCount !== '') parts.push(`${freight.boxCount} boxes`)
  return parts.join(' · ')
}

export function compactDealClipMeta(deal, { stageLabel = '', amountLabel = '' } = {}) {
  const parts = []
  if (stageLabel) parts.push(stageLabel)
  if (amountLabel) parts.push(amountLabel)
  const when = formatDealCalendarDate(
    deal?.bookedOn || deal?.wonOn || deal?.lostOn || deal?.ratesQuotedOn || deal?.queryReceivedOn || deal?.createdAt
  )
  if (when) parts.push(when)
  const freight = compactFreightClipLine(deal?.freight)
  if (freight) parts.push(freight)
  return parts.join(' · ')
}
