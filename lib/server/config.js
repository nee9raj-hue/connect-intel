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
 * True only after Google approves gmail.send and you set GOOGLE_OAUTH_VERIFIED=true on Vercel.
 */
export function isGoogleOAuthVerifiedForCustomers() {
  return String(process.env.GOOGLE_OAUTH_VERIFIED || '').trim().toLowerCase() === 'true'
}

/**
 * Whether the product may show "Connect work Gmail" and start the OAuth flow.
 * - After verification: GOOGLE_OAUTH_VERIFIED=true
 * - During Testing / review: GOOGLE_OAUTH_ALLOW_CONNECT=true (test users in Google Cloud)
 */
export function canOfferCustomerGmailConnect() {
  const hasClient = Boolean(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID)
  if (!hasClient) return false
  if (isGoogleOAuthVerifiedForCustomers()) return true
  if (String(process.env.GOOGLE_OAUTH_ALLOW_CONNECT || '').trim().toLowerCase() === 'true') {
    return true
  }
  return false
}

export function getGoogleOAuthVerificationEnv() {
  const verified = isGoogleOAuthVerifiedForCustomers()
  const allowConnect = canOfferCustomerGmailConnect()
  return {
    verified,
    allowConnect,
    allowConnectEnv: String(process.env.GOOGLE_OAUTH_ALLOW_CONNECT || '').trim() || null,
    verifiedEnv: String(process.env.GOOGLE_OAUTH_VERIFIED || '').trim() || null,
    phase: verified ? 'verified' : allowConnect ? 'testing' : 'pending_verification',
  }
}
