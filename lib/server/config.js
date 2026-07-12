import { allowPaidExternalApis } from './soloInfra.js'

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

export function getPublicGoogleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim()
}

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

/** When false (default), search uses built-in + imported data only — no Apollo/Claude bills. */
export function paidApisEnabled() {
  return allowPaidExternalApis()
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

/**
 * Vercel env `GMAIL_ONBOARDING_PROMPT_ENABLED=true` — show post-onboarding Gmail modal + getting-started step.
 * Only effective when `canOfferCustomerGmailConnect()` is also true (verified or testing beta).
 */
export function isGmailOnboardingPromptEnabled() {
  const raw = String(process.env.GMAIL_ONBOARDING_PROMPT_ENABLED || '').trim().toLowerCase()
  return raw === 'true' || raw === '1' || raw === 'yes'
}

export function getGmailOnboardingPublicConfig() {
  const oauth = getGoogleOAuthVerificationEnv()
  const connectAvailable = canOfferCustomerGmailConnect()
  return {
    promptEnabled: isGmailOnboardingPromptEnabled() && connectAvailable,
    connectAvailable,
    phase: oauth.phase,
    verified: oauth.verified,
  }
}

/**
 * Early-stage email path when CASA / restricted Gmail scopes are deferred.
 * Web sign-in uses openid+profile only; Gmail send/sync via Chrome extension + inbound replies.
 */
export function getCrmEmailStrategy() {
  const webGmailConnectAvailable = canOfferCustomerGmailConnect()
  const oauth = getGoogleOAuthVerificationEnv()
  return {
    mode: webGmailConnectAvailable ? 'web_gmail_oauth' : 'extension_first',
    casaDeferred: !oauth.verified,
    webGmailConnectAvailable,
    googleOAuthPhase: oauth.phase,
    scopesWebApp: ['openid', 'email', 'profile'],
    scopesDeferred: ['gmail.send', 'gmail.readonly'],
    extensionHandles: ['gmail_lead_match', 'trail_sync', 'send_and_log', 'linkedin_capture'],
    recommendedPath: webGmailConnectAvailable
      ? 'Connect work Gmail in Team → Integrations, or use the Chrome extension in Gmail.'
      : 'Install the Connect Intel Chrome extension for Gmail trail sync and send-and-log. In-app Gmail OAuth is deferred until Google security review (CASA).',
  }
}
