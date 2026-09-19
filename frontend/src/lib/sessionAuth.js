const SESSION_TOKEN_KEY = 'connect_intel_session'

export function storeSessionToken(token) {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token)
      sessionStorage.setItem(SESSION_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY)
      sessionStorage.removeItem(SESSION_TOKEN_KEY)
    }
  } catch {
    // ignore private mode
  }
}

export function getSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}
