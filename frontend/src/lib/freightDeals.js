export {
  flattenDealsFromEntries,
  countDealsByStage,
  isClosedDealStage,
} from '../../../lib/dealPipeline.js'

import { getFreightCustomerTypeMeta } from '../../../lib/freightDeal.js'

export {
  FREIGHT_DEAL_STAGES,
  getFreightDealStageMeta,
  getFreightCustomerTypeMeta,
  isFreightDealOrg,
} from '../../../lib/freightDeal.js'

export function freightCustomerTypeLabel(type) {
  return getFreightCustomerTypeMeta(type).shortLabel
}

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
  if (from || to) return `${from || '—'} → ${to || '—'}`
  const countries = freight.courier?.destinationCountries
  if (Array.isArray(countries) && countries.length) {
    return countries
      .map((id) => {
        const labels = { usa: 'USA', uk: 'UK', canada: 'Canada', australia: 'AU', uae: 'UAE', eu: 'EU', singapore: 'SG', other: 'Other' }
        return labels[id] || id
      })
      .join(', ')
  }
  return '—'
}

export function dealCountsFromSummary(pipelineSummary) {
  return pipelineSummary?.openDealCounts || null
}

export function allDealCountsFromSummary(pipelineSummary) {
  return pipelineSummary?.dealCounts || null
}

export function sumDealAmounts(dealRows = []) {
  return dealRows.reduce((sum, row) => sum + (Number(row?.deal?.amount) || 0), 0)
}
