/** User-visible errors must not leak infra (Vercel, env vars, Supabase keys). */

const WORKSPACE_BUSY =
  'Your workspace is taking longer than usual to load. Wait a moment and try again.'

const SIGN_IN_BUSY = 'Sign-in is taking longer than usual. Wait a moment and try again.'

const INFRA_LEAK =
  /supabase|vercel|DATABASE_URL|SUPABASE_|STORE_BACKEND|service role|env var|redeploy|circuit open|postgres|Could not load your workspace/i

const DB_BUSY = /timed out|unavailable|overload|paused|temporarily|522|503|504|521|408/i

export function customerSafeErrorMessage(error, fallback = WORKSPACE_BUSY) {
  const message = String(error?.message || error || '').trim()
  if (!message || INFRA_LEAK.test(message) || DB_BUSY.test(message)) {
    return fallback
  }
  return message
}

export function customerWorkspaceBusyMessage() {
  return WORKSPACE_BUSY
}

export function customerSignInBusyMessage() {
  return SIGN_IN_BUSY
}
