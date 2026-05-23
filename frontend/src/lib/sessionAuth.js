const SESSION_TOKEN_KEY = 'connect_intel_session'

export function storeSessionToken(token) {
  try {
    if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token)
    else sessionStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // ignore private mode
  }
}

export function getSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}
