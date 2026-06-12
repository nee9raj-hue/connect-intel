/** Marketing Hub — Mailchimp-aligned design tokens. */
import { mc } from '../../lib/marketingColors'

export const MH = {
  pageBg: mc.pageBg,
  cardBg: mc.cardBg,
  border: mc.border,
  accent: mc.primary,
  accentTint: mc.primaryLight,
  text: mc.text,
  textSecondary: mc.textMuted,
  textMuted: mc.textLight,
  danger: mc.danger,
  topBarH: 52,
  tabBarH: 40,
}

/** Plain text status styles for campaigns table (no pill badges). */
export const CAMPAIGN_STATUS_TEXT = {
  draft: mc.textMuted,
  scheduled: mc.primary,
  active: mc.primary,
  completed: mc.success,
  sent: mc.success,
  paused: mc.warning,
  stopped: mc.danger,
}

export function campaignStatusTextClass(status) {
  const key = String(status || 'draft').toLowerCase()
  const color = CAMPAIGN_STATUS_TEXT[key] || CAMPAIGN_STATUS_TEXT.draft
  return 'mc-status-text'
}

export function campaignStatusColor(status) {
  const key = String(status || 'draft').toLowerCase()
  return CAMPAIGN_STATUS_TEXT[key] || CAMPAIGN_STATUS_TEXT.draft
}

export const CAMPAIGN_STATUS = {
  completed: { bg: '#eaf3de', color: '#27500a', label: 'Completed' },
  scheduled: { bg: '#e6f1fb', color: '#0c447c', label: 'Scheduled' },
  draft: { bg: '#f0f0ee', color: '#666666', label: 'Draft' },
  stopped: { bg: '#fcebeb', color: '#791f1f', label: 'Stopped' },
  active: { bg: '#fff4ee', color: '#c05621', label: 'Active' },
  sent: { bg: '#eaf3de', color: '#27500a', label: 'Completed' },
}

export const CAMPAIGN_ICON_TINTS = [
  { bg: '#fff4ee', color: '#c05621' },
  { bg: '#f1f5f9', color: '#64748b' },
  { bg: '#fff4ee', color: '#FF773D' },
]

export function campaignInitials(name) {
  const n = String(name || '').trim()
  if (!n) return 'C'
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return n.slice(0, 2).toUpperCase()
}

export function campaignIconTint(index = 0) {
  return CAMPAIGN_ICON_TINTS[index % CAMPAIGN_ICON_TINTS.length]
}

export function formatPct(n, fallback = '—') {
  if (n == null || Number.isNaN(Number(n))) return fallback
  return `${Math.round(Number(n))}%`
}
