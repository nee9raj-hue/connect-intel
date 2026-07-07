import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { resolveOrganizationUuid } from './orgSqlResolve.js'

function flag(name) {
  const v = String(process.env[name] || '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function isEmailSendsEnabled() {
  if (flag('EMAIL_SENDS_OFF') || flag('DISABLE_EMAIL_SENDS')) return false
  return isSupabaseEnabled()
}

const orgUuidCache = { orgs: new Map() }

async function resolveOrgUuid(legacyOrgId, store) {
  if (!legacyOrgId) return null
  return resolveOrganizationUuid(legacyOrgId, orgUuidCache, { store, autoSync: false })
}

/**
 * Append-only email send row (service role). No-op when disabled or table missing.
 */
export async function recordEmailSend({
  organizationId,
  actorUserId,
  source,
  channel = 'email',
  provider = null,
  providerMessageId = null,
  toEmail = null,
  leadId = null,
  campaignId = null,
  enrollmentId = null,
  dealId = null,
  subject = null,
  status = 'sent',
  errorMessage = null,
  metadata = {},
  store = null,
}) {
  if (!isEmailSendsEnabled() || !source) return { skipped: true }

  const orgUuid = await resolveOrgUuid(organizationId, store)
  const normalizedStatus =
    status === 'failed' ? 'failed' : status === 'suppressed' ? 'suppressed' : 'sent'

  const row = {
    legacy_org_id: organizationId || null,
    organization_id: orgUuid,
    actor_legacy_user_id: actorUserId || null,
    channel: String(channel || 'email').slice(0, 32),
    source: String(source).slice(0, 64),
    provider: provider ? String(provider).slice(0, 32) : null,
    provider_message_id: providerMessageId ? String(providerMessageId).slice(0, 128) : null,
    to_email: toEmail ? String(toEmail).slice(0, 320) : null,
    lead_id: leadId ? String(leadId).slice(0, 128) : null,
    campaign_id: campaignId ? String(campaignId).slice(0, 128) : null,
    enrollment_id: enrollmentId ? String(enrollmentId).slice(0, 128) : null,
    deal_id: dealId ? String(dealId).slice(0, 128) : null,
    subject: subject ? String(subject).slice(0, 500) : null,
    status: normalizedStatus,
    error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }

  try {
    await supabaseRest('email_sends', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([row]),
    })
    return { ok: true }
  } catch (error) {
    if (/relation.*email_sends|42P01|schema cache/i.test(String(error?.message || ''))) {
      return { skipped: true, reason: 'table_missing' }
    }
    console.warn('email_sends insert:', error?.message || error)
    return { ok: false, error: error?.message || String(error) }
  }
}

export async function listEmailSendsForOrg(
  legacyOrgId,
  { limit = 50, source = null, leadId = null } = {}
) {
  if (!isEmailSendsEnabled() || !legacyOrgId) return []

  const orgUuid = await resolveOrgUuid(legacyOrgId)
  const cap = Math.min(200, Math.max(1, Number(limit) || 50))
  let path =
    `email_sends?legacy_org_id=eq.${encodeURIComponent(legacyOrgId)}` +
    `&select=id,source,channel,provider,to_email,lead_id,campaign_id,subject,status,sent_at,metadata` +
    `&order=sent_at.desc&limit=${cap}`

  if (orgUuid) {
    path =
      `email_sends?or=(legacy_org_id.eq.${encodeURIComponent(legacyOrgId)},organization_id.eq.${encodeURIComponent(orgUuid)})` +
      `&select=id,source,channel,provider,to_email,lead_id,campaign_id,subject,status,sent_at,metadata` +
      `&order=sent_at.desc&limit=${cap}`
  }
  if (source) path += `&source=eq.${encodeURIComponent(source)}`
  if (leadId) path += `&lead_id=eq.${encodeURIComponent(leadId)}`

  try {
    const rows = await supabaseRest(path, {}, { timeoutMs: 12_000, attempts: 1 })
    return Array.isArray(rows) ? rows : []
  } catch (error) {
    if (/relation.*email_sends|42P01/i.test(String(error?.message || ''))) return []
    throw error
  }
}
