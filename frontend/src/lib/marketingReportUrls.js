import { serializeAppLocation } from './appHistory'

/** Build a shareable Marketing Hub URL (same origin). */
export function marketingReportLocation({ reportId, tab = 'reports', period } = {}) {
  const panelOptions = { tab }
  if (reportId) panelOptions.report = String(reportId)
  if (period) panelOptions.period = period
  return { panel: 'marketing', panelOptions, leadId: null }
}

export function marketingReportUrl(options = {}) {
  if (typeof window === 'undefined') return '/?panel=marketing&tab=reports'
  const qs = serializeAppLocation(marketingReportLocation(options))
  const base = window.location.pathname || '/'
  return qs ? `${window.location.origin}${base}?${qs}` : `${window.location.origin}${base}`
}

/** All campaigns report list — opens in a new browser tab. */
export function openMarketingReportsList(options = {}) {
  const url = marketingReportUrl({ tab: 'reports', ...options })
  window.open(url, '_blank', 'noopener,noreferrer')
  return url
}

/** Single campaign report — opens in a new browser tab. */
export function openMarketingCampaignReport(campaignId, options = {}) {
  if (!campaignId) return null
  const url = marketingReportUrl({ reportId: campaignId, tab: 'reports', ...options })
  window.open(url, '_blank', 'noopener,noreferrer')
  return url
}
