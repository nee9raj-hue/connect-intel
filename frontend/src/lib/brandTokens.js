// Connect Intel — brand colors (#FF773D orange, #64748B slate)

export const brand = {
  primary: '#FF773D',
  primaryHover: '#e5652f',
  primaryText: '#242424',

  navBg: '#64748B',
  navText: '#f8fafc',
  navTextMuted: '#cbd5e1',
  navActive: '#ffffff',
  navActiveBg: 'rgba(255,255,255,0.14)',

  accent: '#64748B',
  accentLight: '#f1f5f9',
  accentText: '#475569',

  pageBg: '#f5f8fa',
  cardBg: '#ffffff',
  border: 'rgba(0,0,0,0.09)',
  borderMedium: 'rgba(0,0,0,0.15)',

  textPrimary: '#33475b',
  textSecondary: '#516f90',
  textMuted: '#7c98b6',

  success: '#27500a',
  successBg: '#eaf3de',
  warning: '#633806',
  warningBg: '#faeeda',
  danger: '#791f1f',
  dangerBg: '#fcebeb',
  info: '#0c447c',
  infoBg: '#e6f1fb',
}

/** @deprecated Pipeline status uses CRM_STATUSES tailwind classes via getStatusMeta(). */
export function leadStatusBrand() {
  return { bg: '#f1f5f9', text: '#64748b' }
}

export function activityBrand(type) {
  const map = {
    call: { bg: '#e6f1fb', text: '#0c447c' },
    email: { bg: '#f1f5f9', text: '#64748b' },
    task: { bg: '#f1f5f9', text: '#64748b' },
    note: { bg: '#faeeda', text: '#633806' },
    meeting: { bg: '#e1f5ee', text: '#085041' },
    status: { bg: '#f1f5f9', text: '#64748b' },
  }
  return map[type] || map.task
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
  root.style.setProperty('--color-ci-brand-hover', b.primaryHover)
  root.style.setProperty('--color-ci-brand-muted', b.accent)
  root.style.setProperty('--color-hs-canvas', b.pageBg)
}
