import crypto from 'node:crypto'
import { CRM_STATUSES } from './crm.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'

const TABLE = 'leads'

function normStatus(status) {
  const s = String(status || 'new').trim()
  return CRM_STATUSES.includes(s) ? s : 'new'
}

function hashPii(value, { phone = false } = {}) {
  const v = phone
    ? String(value || '').replace(/\D/g, '')
    : String(value || '').trim().toLowerCase()
  if (!v) return null
  return crypto.createHash('sha256').update(v).digest('hex')
}

/** Map pipeline entry → enterprise leads row (plaintext in encrypted_*; DB trigger seals). */
export function buildEnterpriseLeadRow(entry, { organizationUuid, assignedProfileId }) {
  if (!entry || !organizationUuid) return null
  const lead = entry.lead || entry
  const legacyLeadId = lead.id || entry.leadId || entry.id
  if (!legacyLeadId) return null

  const crm = entry.crm || {}
  const firstName = lead.firstName || null
  const lastName = lead.lastName || null
  const email = lead.email ? String(lead.email).trim().toLowerCase() : null
  const phone = lead.phone || null

  return {
    legacy_lead_id: String(legacyLeadId),
    organization_id: organizationUuid,
    assigned_to: assignedProfileId || null,
    lead_status: normStatus(crm.status),
    lead_source: lead.source || null,
    lead_score: Number(crm.leadScore) || null,
    company_name: lead.company || null,
    city: lead.city || null,
    state: lead.state || null,
    country: lead.country || null,
    email_hash: hashPii(email),
    phone_hash: hashPii(phone, { phone: true }),
    encrypted_first_name: firstName,
    encrypted_last_name: lastName,
    encrypted_email: email,
    encrypted_phone: phone,
    crm_payload: {
      tagIds: crm.tagIds || [],
      nextFollowUpAt: crm.nextFollowUpAt || null,
      dealCount: Array.isArray(crm.deals) ? crm.deals.length : 0,
    },
    saved_at: entry.savedAt || null,
    updated_at: entry.updatedAt || entry.savedAt || new Date().toISOString(),
  }
}

/** Plain contact fields → leads write payload (DB trigger seals encrypted_*). */
export function mapClientContactToEnterpriseWrite(contact = {}) {
  const firstName = contact.firstName ?? contact.first_name ?? null
  const lastName = contact.lastName ?? contact.last_name ?? null
  const emailRaw = contact.email ?? null
  const phone = contact.phone ?? null

  return {
    encrypted_first_name: firstName || null,
    encrypted_last_name: lastName || null,
    encrypted_email: emailRaw ? String(emailRaw).trim().toLowerCase() : null,
    encrypted_phone: phone || null,
  }
}

export async function resolveOrgUuid(legacyOrgId, cache) {
  if (!legacyOrgId) return null
  if (cache.orgs.has(legacyOrgId)) return cache.orgs.get(legacyOrgId)
  const rows = await supabaseRest(
    `organizations?legacy_id=eq.${encodeURIComponent(legacyOrgId)}&select=id`,
    {},
    { timeoutMs: 15_000, attempts: 2 }
  )
  const id = rows?.[0]?.id || null
  cache.orgs.set(legacyOrgId, id)
  return id
}

export async function resolveProfileId(legacyUserId, cache) {
  if (!legacyUserId) return null
  if (cache.profiles.has(legacyUserId)) return cache.profiles.get(legacyUserId)
  const rows = await supabaseRest(
    `profiles?legacy_user_id=eq.${encodeURIComponent(legacyUserId)}&select=id`,
    {},
    { timeoutMs: 15_000, attempts: 2 }
  )
  const id = rows?.[0]?.id || null
  cache.profiles.set(legacyUserId, id)
  return id
}

export function enterpriseLeadsTableActive() {
  return isSupabaseEnabled()
}

/** Upsert one or more pipeline entries into public.leads (plaintext PII → trigger encrypts). */
export async function syncEnterpriseLeadsFromEntries(entries, { batchSize = 25 } = {}) {
  if (!enterpriseLeadsTableActive()) return { upserted: 0, skipped: 0 }
  const list = Array.isArray(entries) ? entries.filter(Boolean) : []
  if (!list.length) return { upserted: 0, skipped: 0 }

  const cache = { orgs: new Map(), profiles: new Map() }
  const rows = []

  for (const entry of list) {
    const legacyOrgId = entry.organizationId
    if (!legacyOrgId) {
      continue
    }
    const orgUuid = await resolveOrgUuid(legacyOrgId, cache)
    if (!orgUuid) continue

    const assigneeLegacy =
      entry.assignedToUserId || entry.savedByUserId || entry.userId || null
    const profileId = await resolveProfileId(assigneeLegacy, cache)
    const row = buildEnterpriseLeadRow(entry, {
      organizationUuid: orgUuid,
      assignedProfileId: profileId,
    })
    if (row) rows.push(row)
  }

  if (!rows.length) return { upserted: 0, skipped: list.length }

  let upserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    await supabaseRest(`${TABLE}?on_conflict=organization_id,legacy_lead_id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    }, { timeoutMs: 60_000 })
    upserted += chunk.length
  }

  return { upserted, skipped: list.length - rows.length }
}
