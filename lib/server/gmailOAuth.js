import crypto from 'node:crypto'
import { getOAuthRedirectBaseUrl } from './appUrl.js'
import { getOAuthStateSecret } from './oauthSecret.js'

export const COMPANY_MAILBOX = 'invite@connectintel.net'

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email'
export const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

function getClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim()
}

function getClientSecret() {
  return String(process.env.GOOGLE_CLIENT_SECRET || '').trim()
}

export function isGmailOAuthConfigured() {
  return Boolean(getClientId() && getClientSecret())
}

/** Safe diagnostics for UI (no secrets). */
export function getGmailOAuthDiagnostics() {
  const hasClientId = Boolean(getClientId())
  const hasClientSecret = Boolean(getClientSecret())
  const redirectUri = getGmailOAuthRedirectUri()
  return {
    hasClientId,
    hasClientSecret,
    configured: hasClientId && hasClientSecret,
    redirectUri,
    redirectUriIsHttps: redirectUri.startsWith('https://'),
    pkceEnabled: true,
    incrementalAuth: true,
    riscEndpoint: `${getOAuthRedirectBaseUrl()}/api/google/risc`,
    missingEnv: [
      !hasClientId && 'GOOGLE_CLIENT_ID',
      !hasClientSecret && 'GOOGLE_CLIENT_SECRET',
    ].filter(Boolean),
  }
}

export function getGmailOAuthRedirectUri() {
  return `${getOAuthRedirectBaseUrl()}/api/team/email-oauth/callback`
}

function signState(payload) {
  const secret = getOAuthStateSecret()
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyState(state) {
  const secret = getOAuthStateSecret()
  const [body, sig] = String(state || '').split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  if (sig !== expected) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/**
 * Google incremental authorization: request only the scopes needed for this step.
 * @param {'full'|'send_only'|'read_only'|'calendar_only'} scopeMode
 */
export function gmailScopesForKind(
  kind,
  { includeReadScope = false, includeCalendarScope = false, scopeMode = 'full' } = {}
) {
  if (kind === 'user_crm') {
    if (scopeMode === 'send_only') return `${GMAIL_SEND_SCOPE} ${EMAIL_SCOPE}`
    if (scopeMode === 'read_only') return `${GMAIL_READONLY_SCOPE} ${EMAIL_SCOPE}`
    if (scopeMode === 'calendar_only') return `${CALENDAR_EVENTS_SCOPE} ${EMAIL_SCOPE}`
    if (scopeMode === 'send_calendar_bootstrap') {
      return `${GMAIL_SEND_SCOPE} ${CALENDAR_EVENTS_SCOPE} ${EMAIL_SCOPE}`
    }
    const scopes = [GMAIL_SEND_SCOPE, EMAIL_SCOPE]
    if (includeReadScope) scopes.splice(1, 0, GMAIL_READONLY_SCOPE)
    if (includeCalendarScope) scopes.push(CALENDAR_EVENTS_SCOPE)
    return scopes.join(' ')
  }
  return `${GMAIL_SEND_SCOPE} ${EMAIL_SCOPE}`
}

function generatePkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function buildGmailOAuthStartUrl({
  organizationId,
  userId,
  kind = 'invite',
  loginHint,
  upgradeScopes = false,
  includeReadScope = false,
  includeCalendarScope = false,
  scopeMode = null,
} = {}) {
  const clientId = getClientId()
  if (!clientId || !getClientSecret()) {
    throw new Error(
      'Google OAuth is not configured. Add GOOGLE_CLIENT_SECRET on Vercel (Google Cloud → OAuth Web client).'
    )
  }

  const resolvedScopeMode =
    scopeMode ||
    (includeCalendarScope ? 'calendar_only' : upgradeScopes ? 'read_only' : kind === 'user_crm' ? 'send_only' : 'full')

  const pkce = generatePkcePair()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGmailOAuthRedirectUri(),
    response_type: 'code',
    scope: gmailScopesForKind(kind, {
      includeReadScope: includeReadScope || upgradeScopes,
      includeCalendarScope,
      scopeMode: resolvedScopeMode,
    }),
    access_type: 'offline',
    prompt: upgradeScopes || kind === 'user_crm' || resolvedScopeMode !== 'send_only' ? 'consent' : 'select_account',
    include_granted_scopes: 'true',
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    state: signState({
      kind,
      organizationId,
      userId,
      upgradeScopes: Boolean(upgradeScopes),
      scopeMode: resolvedScopeMode,
      pkceVerifier: pkce.verifier,
      n: crypto.randomBytes(8).toString('hex'),
    }),
  })

  const hint = loginHint || (kind === 'invite' ? COMPANY_MAILBOX : '')
  if (hint) params.set('login_hint', hint)

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

async function exchangeCode(code, codeVerifier) {
  const body = new URLSearchParams({
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: getGmailOAuthRedirectUri(),
    grant_type: 'authorization_code',
  })
  if (codeVerifier) body.set('code_verifier', codeVerifier)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Google token exchange failed')
  }
  return data
}

export async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Google token refresh failed')
  }
  return data.access_token
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Could not read Google account email')
  return {
    email: String(data.email || '').toLowerCase(),
    sub: data.id ? String(data.id) : null,
  }
}

export function isAllowedInviteMailbox(email) {
  const normalized = String(email || '').toLowerCase()
  return normalized === COMPANY_MAILBOX || normalized.endsWith('@connectintel.net')
}

export function getEnvInviteGmailOAuth() {
  const refreshToken = String(process.env.GOOGLE_INVITE_REFRESH_TOKEN || '').trim()
  if (!refreshToken) return null
  const email = String(process.env.GOOGLE_INVITE_EMAIL || COMPANY_MAILBOX)
    .trim()
    .toLowerCase()
  return {
    refreshToken,
    email: isAllowedInviteMailbox(email) ? email : COMPANY_MAILBOX,
    connectedAt: null,
    source: 'env',
  }
}

function getPlatformInviteGmailOAuth(store) {
  const oauth = store?.platform?.[0]?.inviteGmailOAuth
  if (oauth?.refreshToken && isAllowedInviteMailbox(oauth.email)) return oauth
  return null
}

/** Env → platform store → org → any org with company mailbox (one connect for all customers). */
export function resolveInviteGmailOAuthForOrg(store, organizationId) {
  const fromEnv = getEnvInviteGmailOAuth()
  if (fromEnv) return fromEnv

  const fromPlatform = getPlatformInviteGmailOAuth(store)
  if (fromPlatform) return fromPlatform

  const orgs = store?.organizations || []
  if (organizationId) {
    const own = orgs.find((o) => o.id === organizationId)?.inviteGmailOAuth
    if (own?.refreshToken) return own
  }
  for (const org of orgs) {
    const oauth = org.inviteGmailOAuth
    if (oauth?.refreshToken && isAllowedInviteMailbox(oauth.email)) {
      return oauth
    }
  }
  return null
}

export function applyPlatformInviteOAuth(draft, oauth) {
  draft.platform = draft.platform?.length ? draft.platform : [{ inviteGmailOAuth: null }]
  draft.platform[0] = {
    ...draft.platform[0],
    inviteGmailOAuth: oauth,
    lastOAuthError: null,
    lastOAuthConnectedAt: oauth.connectedAt,
  }
  for (const org of draft.organizations || []) {
    org.inviteGmailOAuth = oauth
  }
}

export function recordPlatformOAuthError(draft, message) {
  draft.platform = draft.platform?.length ? draft.platform : [{ inviteGmailOAuth: null }]
  draft.platform[0] = {
    ...draft.platform[0],
    lastOAuthError: String(message || 'Unknown error').slice(0, 500),
    lastOAuthErrorAt: new Date().toISOString(),
  }
}

async function exchangeTokensAndEmail(code, existingRefreshToken, codeVerifier) {
  const tokens = await exchangeCode(code, codeVerifier)
  const refreshToken = tokens.refresh_token || existingRefreshToken
  if (!refreshToken) {
    throw new Error(
      'Google did not return a refresh token. Open https://myaccount.google.com/permissions → remove Connect Intel → connect again with consent.'
    )
  }
  const accessToken = tokens.access_token
  const profile = await fetchGoogleProfile(accessToken)
  return {
    refreshToken,
    email: profile.email,
    googleSub: profile.sub,
    connectedAt: new Date().toISOString(),
    scope: tokens.scope || null,
  }
}

export async function completeGmailOAuth(code, { existingRefreshToken = null, codeVerifier = null } = {}) {
  const { refreshToken, email, connectedAt } = await exchangeTokensAndEmail(
    code,
    existingRefreshToken,
    codeVerifier
  )

  if (!isAllowedInviteMailbox(email)) {
    throw new Error(
      `Sign in with ${COMPANY_MAILBOX} (you signed in as ${email}). Use the Google account for your company mailbox.`
    )
  }

  return { refreshToken, email, connectedAt }
}

/** CRM outreach — any Google Workspace / Gmail the user owns (e.g. sales@alvarfresh.com). */
export async function completeCrmUserGmailOAuth(code, { existingRefreshToken = null, codeVerifier = null } = {}) {
  const { refreshToken, email, connectedAt, scope, googleSub } = await exchangeTokensAndEmail(
    code,
    existingRefreshToken,
    codeVerifier
  )
  if (!email.includes('@')) {
    throw new Error('Could not read your Google account email')
  }
  return {
    refreshToken,
    email,
    googleSub,
    connectedAt,
    purpose: 'crm',
    scope: scope || null,
  }
}

export function formatMailboxFrom(name, email) {
  const safeName = String(name || 'Sender')
    .replace(/"/g, "'")
    .replace(/[\r\n<>]/g, ' ')
    .trim()
    .slice(0, 80)
  const mailbox = String(email || '').trim().toLowerCase()
  return `"${safeName}" <${mailbox}>`
}

function encodeMimeHeaderValue(value) {
  return String(value || '').replace(/\r/g, '')
}

function buildRawMime({ from, to, subject, html, text, replyTo, cc, attachments = [] }) {
  const hasAttachments = attachments.length > 0
  const outerBoundary = `ci_outer_${Date.now()}`
  const innerBoundary = `ci_inner_${Date.now()}`

  const ccLine = cc?.length > 0 ? `Cc: ${cc.map((e) => e.trim()).join(', ')}` : null

  const alternativeParts = [
    `--${innerBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    encodeMimeHeaderValue(text),
    '',
    `--${innerBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    encodeMimeHeaderValue(html),
    '',
    `--${innerBoundary}--`,
  ]

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    ccLine,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${encodeMimeHeaderValue(subject)}`,
    'MIME-Version: 1.0',
  ].filter(Boolean)

  if (!hasAttachments) {
    lines.push(`Content-Type: multipart/alternative; boundary="${innerBoundary}"`, '', ...alternativeParts)
    return lines.join('\r\n')
  }

  lines.push(`Content-Type: multipart/mixed; boundary="${outerBoundary}"`, '')
  lines.push(`--${outerBoundary}`)
  lines.push(`Content-Type: multipart/alternative; boundary="${innerBoundary}"`, '', ...alternativeParts, '')

  for (const file of attachments) {
    lines.push(`--${outerBoundary}`)
    lines.push(`Content-Type: ${file.mimeType}; name="${file.filename}"`)
    lines.push('Content-Transfer-Encoding: base64')
    lines.push(`Content-Disposition: attachment; filename="${file.filename}"`, '')
    lines.push(file.contentBase64.replace(/(.{76})/g, '$1\r\n').trim())
    lines.push('')
  }

  lines.push(`--${outerBoundary}--`)
  return lines.join('\r\n')
}

function toBase64Url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function sendViaGmailOAuth({
  refreshToken,
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
  attachments,
}) {
  if (!refreshToken) {
    return { sent: false, error: 'Company mailbox not connected. Click Connect invite@ on Team page.' }
  }

  try {
    const accessToken = await refreshAccessToken(refreshToken)
    const raw = buildRawMime({ from, to, subject, html, text, replyTo, cc, attachments })
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: toBase64Url(raw) }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || `Gmail API error (${response.status})`)
    }

    return {
      sent: true,
      id: data.id,
      threadId: data.threadId || null,
      provider: 'gmail_oauth',
      from,
      to,
    }
  } catch (error) {
    return {
      sent: false,
      error: error.message,
      provider: 'gmail_oauth',
      hint: 'Reconnect company mailbox on Team page (Connect invite@connectintel.net).',
    }
  }
}
