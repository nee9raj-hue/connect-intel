import { readStore } from './store.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { buildEnterpriseLeadRow } from './enterpriseLeadsTable.js'
import { upsertOrganizationRow, upsertProfileRow } from './orgSqlSync.js'

async function upsertLead(entry, orgUuid, profileByLegacyUser, { dryRun }) {
  const lead = entry.lead || entry
  const legacyLeadId = lead.id || entry.id
  if (!legacyLeadId) return null

  const assigneeLegacy = entry.assignedToUserId || entry.savedByUserId || entry.userId
  const assignedProfile = assigneeLegacy ? profileByLegacyUser.get(assigneeLegacy) : null

  const payload = buildEnterpriseLeadRow(entry, {
    organizationUuid: orgUuid,
    assignedProfileId: assignedProfile?.id || null,
  })
  if (!payload) return null

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
      if (dryRun) {
        summary.orgs += 1
        summary.profiles += (store.organizationMemberships || []).filter(
          (m) => m.organizationId === org.id
        ).length
        summary.leads += (store.savedLeads || []).filter((e) => e.organizationId === org.id).length
        continue
      }

      const orgRow = await upsertOrganizationRow(org)
      const orgUuid = orgRow?.id
      if (!orgUuid) {
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
        const profile = await upsertProfileRow(user, orgUuid, membership)
        if (profile?.id) profileByLegacyUser.set(userId, profile)
        summary.profiles += 1
      }

      const entries = (store.savedLeads || []).filter((e) => e.organizationId === org.id)
      for (const entry of entries) {
        await upsertLead(entry, orgUuid, profileByLegacyUser, { dryRun: false })
        summary.leads += 1
      }
      summary.orgs += 1
    } catch (error) {
      summary.errors.push({ org: org.id, error: error?.message || String(error) })
    }
  }

  return summary
}
