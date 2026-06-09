/** Protect PostgREST when Supabase is unhealthy — fail fast instead of hammering. */

const state = {
  open: false,
  openedAt: 0,
  failures: 0,
  lastError: null,
}

const FAILURE_THRESHOLD = 5
const OPEN_MS = 30_000

export function isCircuitOpen() {
  if (!state.open) return false
  if (Date.now() - state.openedAt > OPEN_MS) {
    state.open = false
    state.failures = 0
    return false
  }
  return true
}

export function recordCircuitSuccess() {
  state.failures = 0
  state.open = false
  state.lastError = null
}

export function recordCircuitFailure(error) {
  state.failures += 1
  state.lastError = String(error?.message || error || 'unknown').slice(0, 240)
  if (state.failures >= FAILURE_THRESHOLD) {
    state.open = true
    state.openedAt = Date.now()
  }
}

export function getCircuitStatus() {
  return {
    open: isCircuitOpen(),
    failures: state.failures,
    lastError: state.lastError,
    cooldownMs: state.open ? Math.max(0, OPEN_MS - (Date.now() - state.openedAt)) : 0,
  }
}

export function assertCircuitClosed() {
  if (isCircuitOpen()) {
    throw new Error(
      `Database temporarily unavailable (circuit open). Retry in ${Math.ceil(getCircuitStatus().cooldownMs / 1000)}s.`
    )
  }
}
