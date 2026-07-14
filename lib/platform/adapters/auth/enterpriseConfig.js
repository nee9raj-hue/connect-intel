/**
 * Enterprise SSO configuration — Azure AD, Okta OIDC, SAML (env-driven).
 */

function cleanEnv(name) {
  const raw = process.env[name]
  if (!raw) return ''
  return String(raw).trim().replace(/^["']|["']$/g, '')
}

export const ENTERPRISE_AUTH_PROVIDERS = ['azure-ad', 'okta', 'saml']

export function getEnterpriseAuthConfig(provider) {
  const id = String(provider || '').toLowerCase()

  if (id === 'azure-ad') {
    const tenantId = cleanEnv('AZURE_AD_TENANT_ID') || 'common'
    const issuerRoot = `https://login.microsoftonline.com/${tenantId}`
    const base = `${issuerRoot}/oauth2/v2.0`
    return {
      kind: 'oidc',
      provider: 'azure-ad',
      tenantId,
      clientId: cleanEnv('AZURE_AD_CLIENT_ID'),
      clientSecret: cleanEnv('AZURE_AD_CLIENT_SECRET'),
      issuer: `${issuerRoot}/v2.0`,
      authorizeUrl: `${base}/authorize`,
      tokenUrl: `${base}/token`,
      userinfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
      scopes: 'openid profile email User.Read',
    }
  }

  if (id === 'okta') {
    const domain = cleanEnv('OKTA_DOMAIN').replace(/^https?:\/\//, '').replace(/\/$/, '')
    const issuerPath = cleanEnv('OKTA_ISSUER_PATH') || 'oauth2/default'
    const issuerBase = domain ? `https://${domain}/${issuerPath}` : ''
    return {
      kind: 'oidc',
      provider: 'okta',
      domain,
      clientId: cleanEnv('OKTA_CLIENT_ID'),
      clientSecret: cleanEnv('OKTA_CLIENT_SECRET'),
      issuer: issuerBase,
      authorizeUrl: issuerBase ? `${issuerBase}/v1/authorize` : '',
      tokenUrl: issuerBase ? `${issuerBase}/v1/token` : '',
      userinfoUrl: issuerBase ? `${issuerBase}/v1/userinfo` : '',
      scopes: 'openid profile email',
    }
  }

  if (id === 'saml') {
    return {
      kind: 'saml',
      provider: 'saml',
      entityId: cleanEnv('SAML_SP_ENTITY_ID'),
      idpSsoUrl: cleanEnv('SAML_IDP_SSO_URL'),
      idpCertPem: cleanEnv('SAML_IDP_CERT_PEM'),
      audience: cleanEnv('SAML_AUDIENCE') || cleanEnv('SAML_SP_ENTITY_ID'),
    }
  }

  return null
}

export function isEnterpriseAuthConfigured(provider) {
  const config = getEnterpriseAuthConfig(provider)
  if (!config) return false
  if (config.kind === 'saml') {
    return Boolean(config.idpSsoUrl && config.idpCertPem && config.entityId)
  }
  return Boolean(
    config.clientId &&
      config.clientSecret &&
      config.authorizeUrl &&
      config.tokenUrl &&
      config.userinfoUrl
  )
}

export function listConfiguredEnterpriseProviders() {
  return ENTERPRISE_AUTH_PROVIDERS.filter((p) => isEnterpriseAuthConfigured(p))
}
