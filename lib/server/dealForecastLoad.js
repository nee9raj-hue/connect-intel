import { buildDealsForecast } from '../dealPipeline.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { buildOrgUserResponse, getOrganization } from './organizations.js'
import { loadAllDealsForExport, resolveExportMaxRows } from './dealExport.js'

function formatInr(value) {
  const n = Number(value) || 0
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `₹${n}`
  }
}

export function formatDealsForecastReply(forecast) {
  if (!forecast?.dealCount) {
    return 'You have **no deals** in Pipeline yet. Create deals on leads to build a revenue forecast.'
  }

  const lines = [
    `**Deal forecast** (stage-weighted across ${forecast.dealCount} deal${forecast.dealCount === 1 ? '' : 's'}):`,
    '',
    `- **Open pipeline:** ${formatInr(forecast.openValue)} · ${forecast.openCount} open`,
    `- **Weighted forecast:** ${formatInr(forecast.weightedPipeline)}`,
    `- **30-day outlook:** ${formatInr(forecast.forecast30d)}`,
    `- **90-day outlook:** ${formatInr(forecast.forecast90d)}`,
    `- **Won value:** ${formatInr(forecast.wonValue)}${forecast.winRate ? ` · ${forecast.winRate}% win rate` : ''}`,
  ]

  if (forecast.atRiskValue > 0) {
    lines.push(`- **Stale (21d+):** ${formatInr(forecast.atRiskValue)} needs attention`)
  }

  lines.push('', 'Open **Pipeline → Deals** to filter and export the same numbers.')
  return lines.join('\n')
}

export async function loadDealsForecastForUser(user, store, filters = {}) {
  const resolved = buildOrgUserResponse(
    store.users?.find((row) => row.id === user.id) || user,
    store
  )
  const maxRows = resolveExportMaxRows(resolved, store)
  const org = resolved.organizationId ? getOrganization(store, resolved.organizationId) : null
  const freightOrg = isFreightDealOrg(org, resolved)

  const { deals, total, truncated } = await loadAllDealsForExport(resolved, store, filters, {
    maxRows,
  })

  if (truncated || total > maxRows) {
    return {
      error: 'FORECAST_LIMIT',
      total,
      maxRows,
    }
  }

  return {
    forecast: buildDealsForecast(deals, { freightOrg }),
    total: deals.length,
  }
}

export function isDealsForecastQuestion(message) {
  const lower = String(message || '').toLowerCase()
  return /\b(forecast|month.?end|revenue outlook|weighted pipeline|deal pipeline value|pipeline forecast|30.?day outlook|90.?day outlook|deal forecast)\b/i.test(
    lower
  )
}
