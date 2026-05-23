export const SESSION_COOKIE = 'connect_intel_session'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
export const DEFAULT_SEARCH_LIMIT = 50
export const FREE_FULL_LEAD_PREVIEW_COUNT = 10
/** Free live Perplexity searches per user (top 10 rows show full email + phone). */
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
 * When false (default), customer-facing "Connect work Gmail" is hidden so reps never see
 * Google's "unverified app" screen. Set GOOGLE_OAUTH_VERIFIED=true on Vercel after Google
 * approves gmail.send / gmail.readonly in the Verification center.
 */
export function isGoogleOAuthVerifiedForCustomers() {
  return String(process.env.GOOGLE_OAUTH_VERIFIED || '').toLowerCase() === 'true'
}
