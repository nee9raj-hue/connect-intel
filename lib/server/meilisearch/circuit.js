/** Fail fast when Meilisearch is unreachable — fall back to SQL/json search. */

const state = {
  open: false,
  openedAt: 0,
  failures: 0,
  lastError: null,
}

const FAILURE_THRESHOLD = 2
const OPEN_MS = 60_000

export function isMeiliCircuitOpen() {
  if (!state.open) return false
  if (Date.now() - state.openedAt > OPEN_MS) {
    state.open = false
    state.failures = 0
    return false
  }
  return true
}

export function recordMeiliCircuitSuccess() {
  state.failures = 0
  state.open = false
  state.lastError = null
}

export function recordMeiliCircuitFailure(error) {
  state.failures += 1
  state.lastError = String(error?.message || error || 'unknown').slice(0, 240)
  if (state.failures >= FAILURE_THRESHOLD) {
    state.open = true
    state.openedAt = Date.now()
  }
}

export function getMeiliCircuitStatus() {
  return {
    open: isMeiliCircuitOpen(),
    failures: state.failures,
    lastError: state.lastError,
    cooldownMs: state.open ? Math.max(0, OPEN_MS - (Date.now() - state.openedAt)) : 0,
  }
}
