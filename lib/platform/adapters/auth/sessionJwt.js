/**
 * Session JWT auth adapter — production path (Google + email/password → session cookie).
 */

import {
  createSession,
  destroySession,
  getSessionUser,
  requireUser,
  upsertUser,
} from '../../../server/auth.js'
import { getPublicGoogleClientId } from '../../../server/config.js'
import { resolveAuthProvider } from '../../config/providers.js'
import {
  ENTERPRISE_AUTH_PROVIDERS,
  getEnterpriseAuthConfig,
  isEnterpriseAuthConfigured,
  listConfiguredEnterpriseProviders,
} from './enterpriseConfig.js'
import { buildOidcAuthorizeUrl, completeOidcCallback, getOidcDiagnostics } from './enterpriseOidc.js'

export function createSessionAuthAdapter(providerName = 'session-jwt') {
  const provider = providerName || 'session-jwt'

  return {
    provider,

    async resolveSessionUser(req, res) {
      return requireUser(req, res)
    },

    async getSessionUser(req) {
      return getSessionUser(req)
    },

    async createSession(res, user) {
      return createSession(res, user)
    },

    async upsertUser(profile) {
      return upsertUser(profile)
    },

    async destroySession(req, res) {
      return destroySession(req, res)
    },

    getPublicAuthConfig() {
      const primary = resolveAuthProvider()
      const googleClientId = getPublicGoogleClientId()
      const enterprise = ENTERPRISE_AUTH_PROVIDERS.map((id) => ({
        id,
        configured: isEnterpriseAuthConfigured(id),
        kind: getEnterpriseAuthConfig(id)?.kind || 'oidc',
        startUrl: isEnterpriseAuthConfigured(id) ? `/api/auth/sso/start?provider=${id}` : null,
      }))

      return {
        primary,
        sessionJwt: true,
        google: {
          enabled: primary === 'session-jwt' || primary === 'google-oauth',
          clientId: googleClientId || null,
          configured: Boolean(googleClientId),
        },
        emailPassword: {
          enabled: primary === 'session-jwt',
        },
        enterprise,
        configuredEnterprise: listConfiguredEnterpriseProviders(),
        ssoStartPath: '/api/auth/sso/start',
        ssoCallbackPath: '/api/auth/sso/callback',
      }
    },

    getDiagnostics() {
      return {
        provider,
        oidc: {
          'azure-ad': getOidcDiagnostics('azure-ad'),
          okta: getOidcDiagnostics('okta'),
        },
        saml: getOidcDiagnostics('saml'),
      }
    },

    async startSso(res, providerId) {
      const id = String(providerId || resolveAuthProvider()).toLowerCase()
      if (id === 'saml') {
        if (!isEnterpriseAuthConfigured('saml')) {
          throw new Error(
            'SAML SSO is not configured. Set SAML_SP_ENTITY_ID, SAML_IDP_SSO_URL, SAML_IDP_CERT_PEM. Full SAML assertion parsing ships in a follow-up — use Azure AD or Okta OIDC today.'
          )
        }
        throw new Error(
          'SAML SP-initiated login is reserved for a follow-up release. Configure Azure AD or Okta OIDC (AZURE_AD_* / OKTA_* env) for enterprise SSO now.'
        )
      }

      if (!ENTERPRISE_AUTH_PROVIDERS.includes(id) || id === 'saml') {
        throw new Error(`Unknown SSO provider: ${id}`)
      }

      if (!isEnterpriseAuthConfigured(id)) {
        throw new Error(
          `Enterprise SSO (${id}) is not configured. See docs/ENTERPRISE_INFRASTRUCTURE_V2.md § Auth.`
        )
      }

      const { url } = buildOidcAuthorizeUrl(id)
      res.status(302)
      res.setHeader('Location', url)
      return { redirect: url }
    },

    async completeSsoCallback(req, res, query = {}) {
      const code = String(query.code || '').trim()
      const state = String(query.state || '').trim()
      if (!code || !state) {
        throw new Error('Missing OIDC code or state')
      }
      return completeOidcCallback(req, res, { code, state })
    },
  }
}
