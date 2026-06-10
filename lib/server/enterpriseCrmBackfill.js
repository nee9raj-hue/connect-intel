import crypto from 'node:crypto'
import { CRM_STATUSES } from './crm.js'
import { readStore } from './store.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'

function normStatus(status) {
  const s = String(status || 'new').trim()
  return CRM_STATUSES.includes(s) ? s : 'new'
}

function mapRole(membership) {
  const role = String(membership?.role || 'member').toLowerCase()
  const pipelineRole = String(membership?.pipelineRole || 'member').toLowerCase()
  if (role === 'org_admin' || role === 'admin') return 'admin'
  if (pipelineRole === 'manager') return 'manager'
  return 'rep'
}

function hashPii(value) {
  const v = String(value || '').trim().toLowerCase()
  if (!v) return null
  return crypto.createHash('sha256').update(v).digest('hex')
}

async function sealPii(value) {
  if (!value) return null
  const result = await supabaseRest(
    'rpc/seal_lead_pii',
    {
      method: 'POST',
      body: JSON.stringify({ plaintext: value }),
    },
    { timeoutMs: 20_000 }
  )
  if (typeof result === 'string') return result
  return result ?? null
}

async function upsertOrg(org, { dryRun }) {
  const payload = {
    legacy_id: org.id,
    company_name: org.name || 'Company',
    domain: org.domain || org.emailDomain?.name || null,
    account_type: org.accountType || 'company',
    owner_legacy_user_id: org.ownerUserId || null,
    metadata: {
      workspacePreset: org.workspacePreset || null,
      logoUrl: org.logoUrl || null,
    },
    updated_at: new Date().toISOString(),
  }
  if (dryRun) return { legacy_id: org.id, dryRun: true }
  await supabaseRest('organizations?on_conflict=legacy_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([payload]),
  })
  const rows = await supabaseRest(
    `organizations?legacy_id=eq.${encodeURIComponent(org.id)}&select=id,legacy_id`,
    {},
    { timeoutMs: 15_000 }
  )
  return rows?.[0] || null
}

async function upsertProfile(user, orgUuid, membership, { dryRun }) {
  const payload = {
    legacy_user_id: user.id,
    organization_id: orgUuid,
    email: String(user.email || '').toLowerCase(),
    full_name: user.name || user.email || null,
    role: mapRole(membership),
    pipeline_role: membership?.pipelineRole || null,
    can_search: Boolean(membership?.canSearch),
    metadata: { accountType: user.accountType || null },
    updated_at: new Date().toISOString(),
  }
  if (dryRun) return { legacy_user_id: user.id, dryRun: true }
  await supabaseRest('profiles?on_conflict=legacy_user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([payload]),
  })
  const rows = await supabaseRest(
    `profiles?legacy_user_id=eq.${encodeURIComponent(user.id)}&select=id,legacy_user_id`,
    {},
    { timeoutMs: 15_000 }
  )
  return rows?.[0] || null
}

async function upsertLead(entry, orgUuid, profileByLegacyUser, { dryRun }) {
  const lead = entry.lead || entry
  const legacyLeadId = lead.id || entry.id
  if (!legacyLeadId) return null

  const assigneeLegacy = entry.assignedToUserId || entry.savedByUserId || entry.userId
  const assignedProfile = assigneeLegacy ? profileByLegacyUser.get(assigneeLegacy) : null
  const crm = entry.crm || {}

  const firstName = lead.firstName || null
  const lastName = lead.lastName || null
  const email = lead.email || null
  const phone = lead.phone || null

  const payload = {
    legacy_lead_id: String(legacyLeadId),
    organization_id: orgUuid,
    assigned_to: assignedProfile?.id || null,
    lead_status: normStatus(crm.status),
    lead_source: lead.source || null,
    lead_score: Number(crm.leadScore) || null,
    company_name: lead.company || null,
    city: lead.city || null,
    state: lead.state || null,
    country: lead.country || null,
    email_hash: hashPii(email),
    phone_hash: hashPii(phone?.replace(/\D/g, '')),
    encrypted_first_name: dryRun ? null : await sealPii(firstName),
    encrypted_last_name: dryRun ? null : await sealPii(lastName),
    encrypted_email: dryRun ? null : await sealPii(email),
    encrypted_phone: dryRun ? null : await sealPii(phone),
    crm_payload: {
      tagIds: crm.tagIds || [],
      nextFollowUpAt: crm.nextFollowUpAt || null,
      dealCount: Array.isArray(crm.deals) ? crm.deals.length : 0,
    },
    saved_at: entry.savedAt || null,
    updated_at: entry.updatedAt || entry.savedAt || new Date().toISOString(),
  }

  if (dryRun) return { legacy_lead_id: payload.legacy_lead_id, dryRun: true }

  await supabaseRest('leads?on_conflict=organization_id,legacy_lead_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([payload]),
  })
  return payload
}

export async function backfillEnterpriseCrm({ dryRun = false, orgId = null } = {}) {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase is not configured')
  }

  const store = await readStore()
  const orgs = (store.organizations || []).filter((o) => !orgId || o.id === orgId)
  const summary = { orgs: 0, profiles: 0, leads: 0, errors: [] }

  for (const org of orgs) {
    try {
      const orgRow = await upsertOrg(org, { dryRun })
      const orgUuid = orgRow?.id
      if (!orgUuid && !dryRun) {
        summary.errors.push({ org: org.id, error: 'org upsert failed' })
        continue
      }

      const memberIds = new Set(
        (store.organizationMemberships || [])
          .filter((m) => m.organizationId === org.id)
          .map((m) => m.userId)
      )
      const profileByLegacyUser = new Map()

      for (const userId of memberIds) {
        const user = (store.users || []).find((u) => u.id === userId)
        const membership = (store.organizationMemberships || []).find(
          (m) => m.userId === userId && m.organizationId === org.id
        )
        if (!user) continue
        const profile = await upsertProfile(user, orgUuid, membership, { dryRun })
        if (profile?.id) profileByLegacyUser.set(userId, profile)
        summary.profiles += 1
      }

      const entries = (store.savedLeads || []).filter((e) => e.organizationId === org.id)
      for (const entry of entries) {
        await upsertLead(entry, orgUuid, profileByLegacyUser, { dryRun })
        summary.leads += 1
      }
      summary.orgs += 1
    } catch (error) {
      summary.errors.push({ org: org.id, error: error?.message || String(error) })
    }
  }

  return summary
}
