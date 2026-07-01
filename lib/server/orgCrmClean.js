/**
 * Wipe CRM operational data for one organization (keeps users, org, memberships).
 */

import { pipelineOrgShardName } from './pipelineShard.js'
import {
  fetchAllCollections,
  isSupabaseEnabled,
  supabaseRest,
  upsertCollection,
} from './supabaseClient.js'
import { readStore, updateStorePartial } from './store.js'

const ORG_SCOPED_COLLECTIONS = [
  'savedLeads',
  'chithiChannels',
  'chithiMessages',
  'teamNotes',
  'teamTasks',
  'marketingLists',
  'marketingTemplates',
  'marketingCampaigns',
  'marketingEnrollments',
  'marketingSuppressions',
  'marketingForms',
  'marketingEvents',
  'marketingSegments',
  'marketingApprovals',
  'marketingAutomations',
  'marketingAutomationRuns',
  'marketingLandingPages',
  'marketingBulkSends',
  'marketingBulkRecipients',
  'marketingFeeds',
  'marketingAnalyticsRollups',
  'pipelineSavedViews',
  'crmSequences',
  'crmSequenceEnrollments',
  'activeTradingImports',
  'orgWorkspaceImports',
  'whatsappThreads',
  'whatsappMessages',
  'searches',
  'importJobs',
]

function isMissingTableError(error) {
  const msg = String(error?.message || '')
  return /relation.*does not exist|42P01|not found|schema cache/i.test(msg)
}

function orgUserIds(store, organizationId) {
  return new Set(
    (store.organizationMemberships || [])
      .filter((m) => m.organizationId === organizationId && (m.status || 'active') === 'active')
      .map((m) => m.userId)
      .filter(Boolean)
  )
}

export function resolveOrganization(store, { orgId, nameQuery } = {}) {
  const orgs = store.organizations || []
  if (orgId) {
    const org = orgs.find((o) => o.id === orgId)
    if (!org) throw new Error(`Organization not found: ${orgId}`)
    return org
  }
  const q = String(nameQuery || '').trim().toLowerCase()
  if (!q) throw new Error('Provide orgId or nameQuery')
  const matches = orgs.filter((o) => String(o.name || '').toLowerCase().includes(q))
  if (!matches.length) throw new Error(`No organization matches "${nameQuery}"`)
  if (matches.length > 1) {
    throw new Error(
      `Multiple organizations match "${nameQuery}": ${matches.map((o) => `${o.name} (${o.id})`).join(', ')}`
    )
  }
  return matches[0]
}

function countOrgRows(rows, organizationId, { userIds = null, userIdKey = 'userId' } = {}) {
  if (!Array.isArray(rows)) return 0
  return rows.filter((row) => {
    if (row?.organizationId === organizationId) return true
    if (userIds && userIds.has(row?.[userIdKey])) return true
    if (userIds && userIds.has(row?.createdByUserId)) return true
    return false
  }).length
}

function filterOutOrg(rows, organizationId, { userIds = null, userIdKey = 'userId' } = {}) {
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => {
    if (row?.organizationId === organizationId) return false
    if (userIds && userIds.has(row?.[userIdKey])) return false
    if (userIds && userIds.has(row?.createdByUserId)) return false
    return true
  })
}

async function deletePipelineLeadsForOrg(organizationId, { dryRun }) {
  if (!isSupabaseEnabled()) return { skipped: true, reason: 'supabase_disabled' }
  let count = 0
  try {
    const url = `${process.env.SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/pipeline_leads?select=id&organization_id=eq.${encodeURIComponent(organizationId)}&limit=0`
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      ''
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(60_000),
    })
    if (res.ok) {
      const range = res.headers.get('content-range') || ''
      const match = range.match(/\/(\d+)$/)
      count = match ? Number(match[1]) : 0
    }
  } catch {
    count = 0
  }
  if (dryRun) return { dryRun: true, rowsBefore: count }
  if (!count) return { deleted: 0, rowsAfter: 0 }

  let remaining = count
  while (remaining > 0) {
    try {
      await supabaseRest(
        `pipeline_leads?organization_id=eq.${encodeURIComponent(organizationId)}&limit=2000`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
        { timeoutMs: 120_000, attempts: 2 }
      )
    } catch (error) {
      if (isMissingTableError(error)) return { skipped: true, reason: 'table_missing', deleted: count - remaining }
      throw error
    }
    const next = await fetch(
      `${process.env.SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/pipeline_leads?select=id&organization_id=eq.${encodeURIComponent(organizationId)}&limit=0`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'count=exact',
        },
        signal: AbortSignal.timeout(60_000),
      }
    )
    const range = next.headers.get('content-range') || ''
    const match = range.match(/\/(\d+)$/)
    remaining = match ? Number(match[1]) : 0
    if (remaining >= count) break
    count = remaining
  }
  return { deleted: 'all', rowsAfter: remaining }
}

async function deleteDynamicOrgCollections(organizationId, campaignIds, { dryRun }) {
  const rows = await fetchAllCollections('store_collections?select=collection', { timeoutMs: 90_000 })
  const prefixes = [
    pipelineOrgShardName(organizationId),
    `pipeline_index_${organizationId}`,
    `dashboard_snapshot_${organizationId}`,
    `team_snapshot_${organizationId}_`,
    `activity_snapshot_${organizationId}_`,
    `rep_snapshot_${organizationId}_`,
  ]
  const targets = rows
    .map((r) => r.collection)
    .filter((name) => {
      if (!name) return false
      if (
        campaignIds.some(
          (id) =>
            name === `menroll_${id}` ||
            name === `menroll_meta_${id}` ||
            name === `mcstat_${id}` ||
            name === `mcamp_${id}` ||
            name.startsWith(`menroll_${id}_`)
        )
      ) {
        return true
      }
      if (prefixes.some((p) => name === p || name.startsWith(p))) return true
      return false
    })

  const unique = [...new Set(targets)]
  if (dryRun) return { dryRun: true, collections: unique.length, names: unique.slice(0, 20) }

  for (const collection of unique) {
    await supabaseRest(
      `store_collections?collection=eq.${encodeURIComponent(collection)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      { timeoutMs: 60_000 }
    )
  }
  return { deletedCollections: unique.length }
}

export async function cleanOrganizationCrm({ orgId, nameQuery, dryRun = true } = {}) {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase is not configured')
  }

  const meta = await readStore({
    only: ['organizations', 'organizationMemberships', 'users', 'marketingCampaigns'],
  })
  const org = resolveOrganization(meta, { orgId, nameQuery })
  const userIds = orgUserIds(meta, org.id)

  const store = await readStore({ only: ORG_SCOPED_COLLECTIONS })
  const campaignIds = (store.marketingCampaigns || [])
    .filter((c) => c.organizationId === org.id)
    .map((c) => c.id)

  const counts = {}
  for (const key of ORG_SCOPED_COLLECTIONS) {
    counts[key] = countOrgRows(store[key], org.id, { userIds })
  }
  counts.pipelineShard = 0
  try {
    const shard = await readStore({ only: [pipelineOrgShardName(org.id)] })
    counts.pipelineShard = Array.isArray(shard[pipelineOrgShardName(org.id)])
      ? shard[pipelineOrgShardName(org.id)].length
      : 0
  } catch {
    counts.pipelineShard = 0
  }

  const report = {
    ok: true,
    dryRun,
    organization: { id: org.id, name: org.name },
    memberCount: userIds.size,
    counts,
    campaignShards: campaignIds.length,
    sql: null,
    dynamic: null,
    verify: null,
  }

  if (dryRun) {
    report.totals = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0)
    return report
  }

  await updateStorePartial(ORG_SCOPED_COLLECTIONS, (draft) => {
    for (const key of ORG_SCOPED_COLLECTIONS) {
      if (key === 'searches' || key === 'importJobs') {
        draft[key] = filterOutOrg(draft[key] || [], org.id, { userIds })
      } else {
        draft[key] = filterOutOrg(draft[key] || [], org.id)
      }
    }
    return draft
  })

  await upsertCollection(pipelineOrgShardName(org.id), [])

  report.dynamic = await deleteDynamicOrgCollections(org.id, campaignIds, { dryRun: false })
  report.sql = await deletePipelineLeadsForOrg(org.id, { dryRun: false })

  const after = await readStore({ only: ['savedLeads', 'chithiChannels', 'chithiMessages', 'teamNotes', 'teamTasks'] })
  const pipelineAfter = await readStore({ only: [pipelineOrgShardName(org.id)] })
  report.verify = {
    savedLeads: countOrgRows(after.savedLeads, org.id),
    chithiChannels: countOrgRows(after.chithiChannels, org.id),
    chithiMessages: countOrgRows(after.chithiMessages, org.id),
    teamNotes: countOrgRows(after.teamNotes, org.id),
    teamTasks: countOrgRows(after.teamTasks, org.id),
    pipelineShard:
      Array.isArray(pipelineAfter[pipelineOrgShardName(org.id)]) ?
        pipelineAfter[pipelineOrgShardName(org.id)].length
      : 0,
    clean:
      countOrgRows(after.savedLeads, org.id) === 0 &&
      countOrgRows(after.chithiChannels, org.id) === 0 &&
      countOrgRows(after.chithiMessages, org.id) === 0,
  }
  report.ok = report.verify.clean
  return report
}
