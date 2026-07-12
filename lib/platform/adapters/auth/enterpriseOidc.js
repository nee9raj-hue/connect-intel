/**
 * OIDC enterprise login — Azure AD and Okta.
 * Issues ConnectIntel session JWT after successful IdP authentication.
 */

import crypto from 'node:crypto'
import { getOAuthRedirectBaseUrl } from '../../../server/appUrl.js'
import { signOAuthState, verifyState } from '../../../server/gmailOAuth.js'
import { createSession, upsertUser } from '../../../server/auth.js'
import { getEnterpriseAuthConfig, isEnterpriseAuthConfigured } from './enterpriseConfig.js'

function redirectUri() {
  return `${getOAuthRedirectBaseUrl()}/api/auth/sso/callback`
}

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function buildOidcAuthorizeUrl(provider) {
  const config = getEnterpriseAuthConfig(provider)
  if (!config || config.kind !== 'oidc' || !isEnterpriseAuthConfigured(provider)) {
    throw new Error(`Enterprise OIDC is not configured for ${provider}`)
  }

  const { verifier, challenge } = pkcePair()
  const state = signOAuthState({
    provider,
    verifier,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + 10 * 60 * 1000,
  })

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: config.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
  })

  return { url: `${config.authorizeUrl}?${params}`, state }
}

async function exchangeOidcCode(provider, code, verifier) {
  const config = getEnterpriseAuthConfig(provider)
  if (!config || config.kind !== 'oidc') {
    throw new Error('Invalid OIDC provider')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: String(code || ''),
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })

  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const tokens = await tokenRes.json()
  if (!tokenRes.ok) {
    throw new Error(tokens.error_description || tokens.error || 'OIDC token exchange failed')
  }

  const accessToken = tokens.access_token
  if (!accessToken) throw new Error('OIDC access token missing')

  const userRes = await fetch(config.userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const profile = await userRes.json()
  if (!userRes.ok) {
    throw new Error(profile.error_description || profile.error || 'OIDC userinfo failed')
  }

  const email = String(profile.email || profile.preferred_username || profile.upn || '').toLowerCase()
  if (!email) throw new Error('IdP profile did not include an email')

  return {
    name: profile.name || profile.given_name || email.split('@')[0] || 'User',
    email,
    company: profile.hd || email.split('@')[1] || 'Your Company',
    picture: profile.picture || null,
    authProvider: provider,
  }
}

export async function completeOidcCallback(req, res, { code, state }) {
  const parsed = verifyState(state)
  if (!parsed?.provider || !parsed?.verifier) {
    throw new Error('Invalid or expired SSO state')
  }
  if (parsed.exp && Date.now() > parsed.exp) {
    throw new Error('SSO session expired — try again')
  }

  const profile = await exchangeOidcCode(parsed.provider, code, parsed.verifier)
  const user = await upsertUser(profile)
  const { token } = await createSession(res, user)
  return { user, token, provider: parsed.provider }
}

export function getOidcDiagnostics(provider) {
  const config = getEnterpriseAuthConfig(provider)
  const configured = isEnterpriseAuthConfigured(provider)
  return {
    provider,
    kind: config?.kind || 'oidc',
    configured,
    redirectUri: redirectUri(),
    missingEnv: configured
      ? []
      : provider === 'azure-ad'
        ? ['AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET', 'AZURE_AD_TENANT_ID'].filter(
            (k) => !process.env[k]
          )
        : provider === 'okta'
          ? ['OKTA_DOMAIN', 'OKTA_CLIENT_ID', 'OKTA_CLIENT_SECRET'].filter((k) => !process.env[k])
          : ['SAML_SP_ENTITY_ID', 'SAML_IDP_SSO_URL', 'SAML_IDP_CERT_PEM'].filter((k) => !process.env[k]),
  }
}
