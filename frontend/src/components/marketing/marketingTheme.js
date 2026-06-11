/** Marketing Hub V3 — design tokens (orange + slate brand). */

export const MH = {
  pageBg: '#f5f8fa',
  cardBg: '#ffffff',
  border: 'rgba(0, 0, 0, 0.09)',
  accent: '#FF773D',
  accentTint: '#fff4ee',
  text: '#33475b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  danger: '#dc2626',
  topBarH: 52,
  tabBarH: 40,
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
