export const SESSION_COOKIE = 'connect_intel_session'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
export const DEFAULT_SEARCH_LIMIT = 10
export const FREE_FULL_LEAD_PREVIEW_COUNT = 5
export const LEAD_UNLOCK_PRICE_PAISE = 1000
export const DEFAULT_TRIAL_CREDITS_PAISE = 5000

export function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

/** When false (default), search uses built-in + imported data only — no Apollo/Claude bills. */
export function paidApisEnabled() {
  return String(process.env.ENABLE_PAID_APIS || '').toLowerCase() === 'true'
}
