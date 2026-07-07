import { readStore } from './store.js'
import { buildOrgUserResponse } from './organizations.js'
import { pipelineLeadsTableActive } from './pipelineLeadsTable.js'
import { resolvePipelineTableScopeAsync } from './pipelineTableScope.js'
import { loadPipelineStoreContext, loadPipelineStoreForLeadIds } from './pipelineShard.js'
import { isPipelineEntryVisibleAsync } from './pipelineVisibility.js'
import { supabaseRest } from './supabaseClient.js'
import { mergeLeadForTenantLight } from './tenantIsolation.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']
const TABLE = 'pipeline_leads'

function normalizeEmails(emails = []) {
  return [
    ...new Set(
      (emails || [])
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => e.includes('@') && e.length <= 320)
    ),
  ].slice(0, 20)
}

async function findLeadIdsByEmailSql(user, metaStore, emails) {
  if (!pipelineLeadsTableActive() || !user?.organizationId || !emails.length) return []

  const scope = await resolvePipelineTableScopeAsync(user, metaStore, {})
  const parts = []
  if (scope.organizationId) {
    parts.push(`organization_id=eq.${encodeURIComponent(scope.organizationId)}`)
  }
  if (scope.ownerIds?.length === 1) {
    parts.push(`owner_id=eq.${encodeURIComponent(scope.ownerIds[0])}`)
  } else if (scope.ownerIds?.length > 1) {
    parts.push(`owner_id=in.(${scope.ownerIds.map(encodeURIComponent).join(',')})`)
  }
  if (!parts.length) return []

  const inList = emails.map((e) => encodeURIComponent(e)).join(',')
  parts.push(`email=in.(${inList})`)

  const rows = await supabaseRest(
    `${TABLE}?${parts.join('&')}&select=lead_id,email&limit=25`,
    {},
    { timeoutMs: 15_000, attempts: 1 }
  )
  if (!Array.isArray(rows)) return []
  return rows.map((r) => r.lead_id).filter(Boolean)
}

async function findLeadIdsByEmailShard(user, metaStore, emails) {
  const { pipelineStore } = await loadPipelineStoreContext(user, { shardOnly: true })
  const emailSet = new Set(emails)
  const matches = []
  for (const entry of pipelineStore.savedLeads || []) {
    const email = String(entry.lead?.email || entry.email || '')
      .trim()
      .toLowerCase()
    if (!emailSet.has(email)) continue
    const visible = await isPipelineEntryVisibleAsync(user, entry, metaStore)
    if (!visible) continue
    const leadId = entry.lead?.id || entry.id
    if (leadId) matches.push(String(leadId))
    if (matches.length >= 10) break
  }
  return matches
}

/**
 * Match Gmail-visible participant emails to pipeline leads (workspace-scoped).
 * Constitution: no bulk inbox import — match only, for user-initiated CRM actions.
 */
export async function matchPipelineLeadsByEmails(user, emails = []) {
  const normalized = normalizeEmails(emails)
  if (!normalized.length) return { matches: [], emails: [] }

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const dbUser = metaStore.users.find((u) => u.id === user.id) || user
  const scopedUser = buildOrgUserResponse(dbUser, metaStore)

  let leadIds = []
  try {
    leadIds = await findLeadIdsByEmailSql(scopedUser, metaStore, normalized)
  } catch {
    leadIds = []
  }
  if (!leadIds.length) {
    leadIds = await findLeadIdsByEmailShard(scopedUser, metaStore, normalized)
  }

  leadIds = [...new Set(leadIds)].slice(0, 10)
  if (!leadIds.length) return { matches: [], emails: normalized }

  const { visible } = await loadPipelineStoreForLeadIds(scopedUser, leadIds)
  const store = { ...metaStore, savedLeads: visible }
  const matches = visible.map((entry) => {
    const merged = mergeLeadForTenantLight(store, scopedUser, entry)
    const lead = merged?.lead || merged
    return {
      leadId: lead?.id || entry.lead?.id,
      name: [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead',
      company: lead?.company || '',
      email: lead?.email || '',
      status: lead?.crm?.status || entry.crm?.status || null,
      pipelineUrl: `https://connectintel.net/?panel=pipeline&lead=${encodeURIComponent(lead?.id || '')}`,
    }
  })

  return { matches, emails: normalized }
}
