import { createSessionAuthAdapter } from './sessionJwt.js'

/** All enterprise providers share session JWT issuance after IdP login. */
export function createAuthAdapter(provider) {
  const id = String(provider || 'session-jwt').toLowerCase()

  switch (id) {
    case 'session-jwt':
    case 'google-oauth':
    case 'supabase-auth':
    case 'azure-ad':
    case 'okta':
    case 'saml':
      return createSessionAuthAdapter(id)
    default:
      return createSessionAuthAdapter('session-jwt')
  }
}

export { createSessionAuthAdapter } from './sessionJwt.js'
