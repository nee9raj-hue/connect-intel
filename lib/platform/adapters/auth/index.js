import { requireUser } from '../../../server/auth.js'

/** Session JWT + Google OAuth — provider-agnostic auth port (today's production path). */
export function createSessionAuthAdapter() {
  return {
    provider: 'session-jwt',
    async resolveSessionUser(req, res) {
      return requireUser(req, res)
    },
  }
}

export function createAuthAdapter(provider) {
  switch (provider) {
    case 'session-jwt':
    case 'google-oauth':
    default:
      return createSessionAuthAdapter()
  }
}
