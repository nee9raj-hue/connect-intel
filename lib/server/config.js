export const SESSION_COOKIE = 'connect_intel_session'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
export const DEFAULT_SEARCH_LIMIT = 50
export const FREE_FULL_LEAD_PREVIEW_COUNT = 5
/** Top N search rows show full email + phone without spending credits. */
export const FREE_AI_DISCOVERY_SEARCHES = 3
/** ₹1 per email or phone reveal after free AI searches are used. */
export const LEAD_FIELD_UNLOCK_PRICE_PAISE = 100
/** Minimum total shown in AI prospect search UI when results exist */
export const AI_SEARCH_DISPLAY_TOTAL_MIN = 50
export const AI_SEARCH_FETCH_COUNT = 50
/** Legacy whole-lead unlock (deprecated — use per-field). */
export const LEAD_UNLOCK_PRICE_PAISE = LEAD_FIELD_UNLOCK_PRICE_PAISE
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

/**
 * When GOOGLE_OAUTH_VERIFIED=false, customer Gmail connect is blocked.
 * When unset and GOOGLE_CLIENT_ID exists, allow HubSpot-style work Gmail connect (no DNS).
 */
export function isGoogleOAuthVerifiedForCustomers() {
  const flag = String(process.env.GOOGLE_OAUTH_VERIFIED || '').trim().toLowerCase()
  if (flag === 'true') return true
  if (flag === 'false') return false
  return Boolean(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID)
}
