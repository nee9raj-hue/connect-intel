// Connect Intel — single source of truth for brand colors (June 2026)

export const brand = {
  primary: '#f97316',
  primaryHover: '#ea6c0a',
  primaryText: '#ffffff',

  navBg: '#1a1a2e',
  navText: '#e8e8f0',
  navTextMuted: '#9999bb',
  navActive: '#ffffff',
  navActiveBg: 'rgba(255,255,255,0.12)',

  accent: '#3730a3',
  accentLight: '#eeedfe',
  accentText: '#3c3489',

  pageBg: '#f5f5f3',
  cardBg: '#ffffff',
  border: 'rgba(0,0,0,0.09)',
  borderMedium: 'rgba(0,0,0,0.15)',

  textPrimary: '#111111',
  textSecondary: '#666666',
  textMuted: '#999999',

  success: '#27500a',
  successBg: '#eaf3de',
  warning: '#633806',
  warningBg: '#faeeda',
  danger: '#791f1f',
  dangerBg: '#fcebeb',
  info: '#0c447c',
  infoBg: '#e6f1fb',

  statusNew: { bg: '#e6f1fb', text: '#0c447c' },
  statusContacted: { bg: '#eeedfe', text: '#3c3489' },
  statusFollowup: { bg: '#faeeda', text: '#633806' },
  statusReplied: { bg: '#e1f5ee', text: '#085041' },
  statusQualified: { bg: '#e1f5ee', text: '#085041' },
  statusWon: { bg: '#eaf3de', text: '#27500a' },
  statusLost: { bg: '#fcebeb', text: '#791f1f' },

  activityCall: { bg: '#e6f1fb', text: '#0c447c' },
  activityEmail: { bg: '#eeedfe', text: '#3c3489' },
  activityTask: { bg: '#f1efe8', text: '#5f5e5a' },
  activityNote: { bg: '#faeeda', text: '#633806' },
  activityMeeting: { bg: '#e1f5ee', text: '#085041' },
  activityStatus: { bg: '#eeedfe', text: '#3c3489' },
}

const STATUS_TOKEN_MAP = {
  new: 'statusNew',
  contacted: 'statusContacted',
  follow_up: 'statusFollowup',
  replied: 'statusReplied',
  qualified: 'statusQualified',
  won: 'statusWon',
  lost: 'statusLost',
  active_trading: 'statusQualified',
}

export function leadStatusBrand(statusId) {
  const key = STATUS_TOKEN_MAP[statusId] || 'statusNew'
  return brand[key]
}

const ACTIVITY_TOKEN_MAP = {
  call: 'activityCall',
  email: 'activityEmail',
  task: 'activityTask',
  note: 'activityNote',
  meeting: 'activityMeeting',
  status: 'activityStatus',
}

export function activityBrand(type) {
  const key = ACTIVITY_TOKEN_MAP[type] || 'activityTask'
  return brand[key]
}

/** Apply CSS custom properties on :root for use in stylesheets. */
export function applyBrandCssVars(doc = document) {
  const root = doc.documentElement
  const b = brand
  root.style.setProperty('--brand-primary', b.primary)
  root.style.setProperty('--brand-primary-hover', b.primaryHover)
  root.style.setProperty('--brand-primary-text', b.primaryText)
  root.style.setProperty('--brand-nav-bg', b.navBg)
  root.style.setProperty('--brand-nav-text', b.navText)
  root.style.setProperty('--brand-nav-text-muted', b.navTextMuted)
  root.style.setProperty('--brand-nav-active', b.navActive)
  root.style.setProperty('--brand-nav-active-bg', b.navActiveBg)
  root.style.setProperty('--brand-accent', b.accent)
  root.style.setProperty('--brand-accent-light', b.accentLight)
  root.style.setProperty('--brand-accent-text', b.accentText)
  root.style.setProperty('--brand-page-bg', b.pageBg)
  root.style.setProperty('--brand-card-bg', b.cardBg)
  root.style.setProperty('--brand-border', b.border)
  root.style.setProperty('--brand-border-medium', b.borderMedium)
  root.style.setProperty('--brand-text-primary', b.textPrimary)
  root.style.setProperty('--brand-text-secondary', b.textSecondary)
  root.style.setProperty('--brand-text-muted', b.textMuted)
  root.style.setProperty('--brand-success', b.success)
  root.style.setProperty('--brand-success-bg', b.successBg)
  root.style.setProperty('--brand-warning', b.warning)
  root.style.setProperty('--brand-warning-bg', b.warningBg)
  root.style.setProperty('--brand-danger', b.danger)
  root.style.setProperty('--brand-danger-bg', b.dangerBg)
  root.style.setProperty('--brand-info', b.info)
  root.style.setProperty('--brand-info-bg', b.infoBg)
  root.style.setProperty('--hs-brand', b.primary)
  root.style.setProperty('--hs-brand-hover', b.primaryHover)
  root.style.setProperty('--hs-brand-soft', '#fff4ee')
  root.style.setProperty('--hs-brand-border', '#ffd4b8')
  root.style.setProperty('--color-ci-brand', b.primary)
  root.style.setProperty('--color-hs-canvas', b.pageBg)
}
