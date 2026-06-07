export {
  flattenDealsFromEntries,
  countDealsByStage,
  isClosedDealStage,
} from '../../../lib/dealPipeline.js'

export {
  CARGO_READINESS_OPTIONS,
  TRANSPORT_MODE_OPTIONS,
  emptyFreightRfq,
  emptyFreightBox,
  isFreightDealOrg,
} from '../../../lib/freightDeal.js'

export { getDealStageMeta, getDealStagesForFreight, RFQ_DEAL_STAGE } from './crmConstants'
export { formatDealValue } from './crmTimeline'

export function transportModeLabel(mode) {
  if (mode === 'air') return 'Air'
  if (mode === 'ocean') return 'Ocean'
  if (mode === 'air_ocean') return 'Air + Ocean'
  return mode ? String(mode) : '—'
}

export function freightRouteLabel(freight) {
  if (!freight) return '—'
  const from = [freight.pickupCity, freight.pickupZip].filter(Boolean).join(' ')
  const to = [freight.deliveryCity, freight.deliveryZip].filter(Boolean).join(' ')
  if (!from && !to) return '—'
  return `${from || '—'} → ${to || '—'}`
}

export function dealCountsFromSummary(pipelineSummary) {
  return pipelineSummary?.openDealCounts || pipelineSummary?.dealCounts || null
}
