import { readStore } from './store.js'
import { buildOrgUserResponse } from './organizations.js'
import { pipelineLeadsTableActive } from './pipelineLeadsTable.js'
import { resolvePipelineTableScopeAsync } from './pipelineTableScope.js'
import { loadPipelineStoreContext, loadPipelineStoreForLeadIds } from './pipelineShard.js'
import { isPipelineEntryVisibleAsync } from './pipelineVisibility.js'
import { supabaseRest } from './supabaseClient.js'
import { mergeLeadForTenantLight } from './tenantIsolation.js'
import { searchPipelineLeadIdsViaTable } from './pipelineTableSearch.js'
import { pipelineEntryMatchesSearch } from './pipelineQuery.js'

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

/** Pull company/name hints from a Gmail subject line. */
export function subjectSearchHints(subject = '') {
  const cleaned = String(subject || '')
    .trim()
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .trim()
  if (cleaned.length < 2) return ''
  if (/^(inbox|sent mail|sent|drafts|spam|trash)$/i.test(cleaned)) return ''

  const forWithMatch = cleaned.match(/\bfor\s+(.+?)\s+with\b/i)
  if (forWithMatch?.[1]?.trim().length >= 2) return forWithMatch[1].trim()

  const withSplit = cleaned.split(/\s+with\s+/i)[0]?.trim()
  if (withSplit && withSplit.length >= 2 && withSplit.length <= 80) return withSplit

  return cleaned.slice(0, 80)
}

/** Company hints from participant email domains (e.g. sales@alvarfresh.com → alvar fresh). */
export function emailDomainSearchHints(emails = []) {
  const hints = new Set()
  const generic =
    /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|protonmail|aol|zoho|yandex|mail)$/

  for (const email of emails) {
    const domain = String(email || '').split('@')[1]?.toLowerCase()
    if (!domain) continue
    const root = domain.split('.')[0]
    if (!root || root.length < 3 || generic.test(root)) continue
    hints.add(root)
    const splitMatch = root.match(
      /^(.+?)(fresh|food|foods|corp|inc|ltd|llc|co|group|global|logistics|shipping|exports|import|trade|tech|labs|studio|works)$/i
    )
    if (splitMatch?.[1]?.length >= 2) {
      hints.add(`${splitMatch[1]} ${splitMatch[2]}`.trim())
    }
  }

  return [...hints].slice(0, 8)
}

export function buildExtensionSearchQuery({
  subject = '',
  recipientNames = [],
  search = '',
  domainHints = [],
  emails = [],
} = {}) {
  const parts = []
  const explicit = String(search || '').trim()
  if (explicit.length >= 2) parts.push(explicit)

  const subjectHint = subjectSearchHints(subject)
  if (subjectHint) parts.push(subjectHint)

  for (const name of recipientNames || []) {
    const n = String(name || '').trim()
    if (n.length >= 2 && n.length <= 60) parts.push(n)
  }

  for (const hint of domainHints || []) {
    const h = String(hint || '').trim()
    if (h.length >= 2) parts.push(h)
  }

  for (const hint of emailDomainSearchHints(emails)) {
    parts.push(hint)
  }

  return [...new Set(parts)].join(' ').slice(0, 120)
}

function formatLeadMatch(store, scopedUser, entry) {
  const merged = mergeLeadForTenantLight(store, scopedUser, entry)
  const lead = merged?.lead || merged
  return {
    leadId: lead?.id || entry.lead?.id,
    name: [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead',
    company: lead?.company || '',
    title: lead?.title || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    city: lead?.city || '',
    state: lead?.state || '',
    linkedin: lead?.linkedin || '',
    status: lead?.crm?.status || entry.crm?.status || null,
    pipelineUrl: `https://connectintel.net/?panel=pipeline&lead=${encodeURIComponent(lead?.id || '')}`,
  }
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

function participantDomains(emails = []) {
  const generic =
    /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|protonmail|aol|zoho|yandex|mail)$/
  return [
    ...new Set(
      emails
        .map((e) => String(e || '').split('@')[1]?.toLowerCase())
        .filter((d) => d && !generic.test(d.split('.')[0]))
    ),
  ].slice(0, 5)
}

async function findLeadIdsByEmailDomainSql(user, metaStore, emails) {
  const domains = participantDomains(emails)
  if (!pipelineLeadsTableActive() || !user?.organizationId || !domains.length) return []

  const scope = await resolvePipelineTableScopeAsync(user, metaStore, {})
  const scopeParts = []
  if (scope.organizationId) {
    scopeParts.push(`organization_id=eq.${encodeURIComponent(scope.organizationId)}`)
  }
  if (scope.ownerIds?.length === 1) {
    scopeParts.push(`owner_id=eq.${encodeURIComponent(scope.ownerIds[0])}`)
  } else if (scope.ownerIds?.length > 1) {
    scopeParts.push(`owner_id=in.(${scope.ownerIds.map(encodeURIComponent).join(',')})`)
  }
  if (!scopeParts.length) return []

  const domainClauses = domains.map(
    (d) => `email.ilike.${encodeURIComponent(`%@${d}`)}`
  )
  const query = `${scopeParts.join('&')}&or=(${domainClauses.join(',')})&select=lead_id,email&limit=25`

  const rows = await supabaseRest(`${TABLE}?${query}`, {}, { timeoutMs: 15_000, attempts: 1 })
  if (!Array.isArray(rows)) return []
  return rows.map((r) => r.lead_id).filter(Boolean)
}

async function findLeadIdsByEmailDomainShard(user, metaStore, emails) {
  const domains = participantDomains(emails)
  if (!domains.length) return []

  const { pipelineStore } = await loadPipelineStoreContext(user, { shardOnly: true })
  const matches = []
  for (const entry of pipelineStore.savedLeads || []) {
    const email = String(entry.lead?.email || entry.email || '')
      .trim()
      .toLowerCase()
    const domain = email.split('@')[1]
    if (!domain || !domains.includes(domain)) continue
    const visible = await isPipelineEntryVisibleAsync(user, entry, metaStore)
    if (!visible) continue
    const leadId = entry.lead?.id || entry.id
    if (leadId) matches.push(String(leadId))
    if (matches.length >= 10) break
  }
  return matches
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

async function findLeadIdsBySearchShard(user, metaStore, rawQ) {
  const q = String(rawQ || '').trim()
  if (q.length < 2) return []

  const { pipelineStore } = await loadPipelineStoreContext(user, { shardOnly: true })
  const matches = []
  for (const entry of pipelineStore.savedLeads || []) {
    if (!pipelineEntryMatchesSearch(entry, q)) continue
    const visible = await isPipelineEntryVisibleAsync(user, entry, metaStore)
    if (!visible) continue
    const leadId = entry.lead?.id || entry.id
    if (leadId) matches.push(String(leadId))
    if (matches.length >= 10) break
  }
  return matches
}

async function findLeadIdsBySearch(user, metaStore, rawQ) {
  const q = String(rawQ || '').trim()
  if (q.length < 2) return []

  let leadIds = []
  try {
    leadIds = (await searchPipelineLeadIdsViaTable(user, metaStore, { q }, { limit: 10 })) || []
  } catch {
    leadIds = []
  }
  if (!leadIds.length) {
    leadIds = await findLeadIdsBySearchShard(user, metaStore, q)
  }
  return [...new Set(leadIds)].slice(0, 10)
}

/**
 * Match Gmail thread context to pipeline leads (workspace-scoped).
 * Constitution: no bulk inbox import — match only, for user-initiated CRM actions.
 */
export async function matchPipelineLeadsForExtension(
  user,
  {
    emails = [],
    excludeEmails = [],
    subject = '',
    recipientNames = [],
    search = '',
    domainHints = [],
  } = {}
) {
  const excludeSet = new Set(normalizeEmails(excludeEmails))
  const normalized = normalizeEmails(emails).filter((e) => !excludeSet.has(e))
  const searchQuery = buildExtensionSearchQuery({
    subject,
    recipientNames,
    search,
    domainHints,
    emails: normalized,
  })

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const dbUser = metaStore.users.find((u) => u.id === user.id) || user
  const scopedUser = buildOrgUserResponse(dbUser, metaStore)

  let leadIds = []
  let matchedBy = null

  if (normalized.length) {
    try {
      leadIds = await findLeadIdsByEmailSql(scopedUser, metaStore, normalized)
    } catch {
      leadIds = []
    }
    if (!leadIds.length) {
      leadIds = await findLeadIdsByEmailShard(scopedUser, metaStore, normalized)
    }
    if (!leadIds.length) {
      try {
        leadIds = await findLeadIdsByEmailDomainSql(scopedUser, metaStore, normalized)
      } catch {
        leadIds = []
      }
    }
    if (!leadIds.length) {
      leadIds = await findLeadIdsByEmailDomainShard(scopedUser, metaStore, normalized)
    }
    if (leadIds.length) matchedBy = 'email'
  }

  if (!leadIds.length && searchQuery.length >= 2) {
    leadIds = await findLeadIdsBySearch(scopedUser, metaStore, searchQuery)
    if (leadIds.length) matchedBy = 'search'
  }

  leadIds = [...new Set(leadIds)].slice(0, 10)
  if (!leadIds.length) {
    return { matches: [], emails: normalized, searchQuery, matchedBy }
  }

  const { visible } = await loadPipelineStoreForLeadIds(scopedUser, leadIds)
  const store = { ...metaStore, savedLeads: visible }
  const matches = visible.map((entry) => formatLeadMatch(store, scopedUser, entry))

  return { matches, emails: normalized, searchQuery, matchedBy }
}

/** @deprecated Use matchPipelineLeadsForExtension — kept for callers passing email arrays only. */
export async function matchPipelineLeadsByEmails(user, emailsOrInput) {
  if (emailsOrInput && typeof emailsOrInput === 'object' && !Array.isArray(emailsOrInput)) {
    return matchPipelineLeadsForExtension(user, emailsOrInput)
  }
  return matchPipelineLeadsForExtension(user, { emails: emailsOrInput })
}
