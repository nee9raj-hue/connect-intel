import { api } from './api'

let cachedAuthConfig = null
let loadPromise = null

export const ENTERPRISE_SSO_LABELS = {
  'azure-ad': 'Sign in with Microsoft',
  okta: 'Sign in with Okta',
  saml: 'Sign in with SSO',
}

const EMPTY_AUTH = {
  primary: 'session-jwt',
  sessionJwt: true,
  google: { enabled: true, configured: false, clientId: null },
  emailPassword: { enabled: true },
  enterprise: [],
  configuredEnterprise: [],
}

/** Runtime auth capabilities from /api/public-config (no secrets). */
export async function resolvePublicAuthConfig() {
  if (cachedAuthConfig) return cachedAuthConfig

  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const data = await api.getPublicConfig()
        cachedAuthConfig = data?.auth ? { ...EMPTY_AUTH, ...data.auth } : { ...EMPTY_AUTH }
      } catch {
        cachedAuthConfig = { ...EMPTY_AUTH }
      }
      return cachedAuthConfig
    })()
  }

  return loadPromise
}

export function getConfiguredEnterpriseProviders(auth) {
  return (auth?.enterprise || []).filter((entry) => entry.configured && entry.startUrl)
}

export function isEnterprisePrimary(auth) {
  const primary = String(auth?.primary || '').toLowerCase()
  return primary === 'azure-ad' || primary === 'okta' || primary === 'saml'
}
