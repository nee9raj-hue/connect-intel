/** Marketing Hub V3 — design tokens (indigo, no orange). */

export const MH = {
  pageBg: '#f5f5f3',
  cardBg: '#ffffff',
  border: 'rgba(0, 0, 0, 0.09)',
  accent: '#3730a3',
  accentTint: '#eeedfe',
  text: '#111111',
  textSecondary: '#666666',
  textMuted: '#999999',
  danger: '#dc2626',
  topBarH: 52,
  tabBarH: 40,
}

export const CAMPAIGN_STATUS = {
  completed: { bg: '#eaf3de', color: '#27500a', label: 'Completed' },
  scheduled: { bg: '#e6f1fb', color: '#0c447c', label: 'Scheduled' },
  draft: { bg: '#f0f0ee', color: '#666666', label: 'Draft' },
  stopped: { bg: '#fcebeb', color: '#791f1f', label: 'Stopped' },
  active: { bg: '#eeedfe', color: '#3c3489', label: 'Active' },
  sent: { bg: '#eaf3de', color: '#27500a', label: 'Completed' },
}

export const CAMPAIGN_ICON_TINTS = [
  { bg: '#eeedfe', color: '#3c3489' },
  { bg: '#e6f1fb', color: '#0c447c' },
  { bg: '#e1f5ee', color: '#085041' },
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
