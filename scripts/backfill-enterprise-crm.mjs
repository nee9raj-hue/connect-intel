#!/usr/bin/env node
/**
 * Backfill organizations, profiles, leads from store_collections JSON → enterprise tables.
 *
 * Prereqs:
 *   1. Run supabase/migrations/20260613120000_enterprise_crm_schema.sql
 *   2. Create Vault secret:
 *      SELECT vault.create_secret('<random-32+chars>', 'connect_intel_lead_pii', 'Lead PII key');
 *
 * Usage:
 *   node scripts/backfill-enterprise-crm.mjs [--dry-run] [--org-id org_xxx]
 */

import { readStore } from '../lib/server/store.js'
import { isSupabaseEnabled, supabaseRest } from '../lib/server/supabaseClient.js'
import { buildEnterpriseLeadRow } from '../lib/server/enterpriseLeadsTable.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const orgIdFlag = args.find((a) => a.startsWith('--org-id='))
const onlyOrgId = orgIdFlag ? orgIdFlag.split('=')[1] : null

function mapRole(membership) {
  const role = String(membership?.role || 'member').toLowerCase()
  const pipelineRole = String(membership?.pipelineRole || 'member').toLowerCase()
  if (role === 'org_admin' || role === 'admin') return 'admin'
  if (pipelineRole === 'manager') return 'manager'
  return 'rep'
}

async function upsertOrg(org) {
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

async function upsertProfile(user, orgUuid, membership) {
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

async function upsertLead(entry, orgUuid, profileByLegacyUser) {
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

  if (dryRun) return payload

  await supabaseRest('leads?on_conflict=organization_id,legacy_lead_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([payload]),
  })
  return payload
}

async function main() {
  if (!isSupabaseEnabled()) {
    console.error('Supabase not configured')
    process.exit(1)
  }

  const store = await readStore()
  const orgs = (store.organizations || []).filter((o) => !onlyOrgId || o.id === onlyOrgId)
  if (!orgs.length) {
    console.log('No organizations to backfill')
    return
  }

  let leadCount = 0
  for (const org of orgs) {
    const orgRow = await upsertOrg(org)
    const orgUuid = orgRow?.id
    if (!orgUuid && !dryRun) {
      console.warn('Skip org — no UUID', org.id)
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
      const profile = await upsertProfile(user, orgUuid, membership)
      if (profile?.id) profileByLegacyUser.set(userId, profile)
    }

    const entries = (store.savedLeads || []).filter((e) => e.organizationId === org.id)
    for (const entry of entries) {
      await upsertLead(entry, orgUuid, profileByLegacyUser)
      leadCount += 1
    }

    console.log(`✓ ${org.name || org.id}: ${entries.length} leads`)
  }

  console.log(
    dryRun
      ? `Dry run complete (${leadCount} leads would be written)`
      : `Backfill complete — ${leadCount} leads`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
