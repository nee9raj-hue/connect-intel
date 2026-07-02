import {
  meiliEnabled,
  testMeilisearchConnection,
  meilisearchIndexStats,
  countMeilisearchDocuments,
  MEILI_CRM_INDEX,
} from './meilisearch/client.js'
import {
  syncAllOrganizationsToMeilisearch,
  syncOrgCrmToMeilisearch,
  loadOrgPipelineEntries,
  countExpectedMeilisearchDocs,
} from './meilisearch/sync.js'
import { readStore } from './store.js'

async function countIndexedDocsForOrg(organizationId) {
  if (!meiliEnabled() || !organizationId) return 0
  return countMeilisearchDocuments(MEILI_CRM_INDEX, `organizationId = "${organizationId}"`)
}

export async function backfillMeilisearchForOrg(orgId) {
  if (!meiliEnabled()) throw new Error('Meilisearch not configured')
  const connection = await testMeilisearchConnection()
  if (!connection.ok) throw new Error(connection.error || 'Meilisearch unreachable')

  const store = await readStore({ only: ['organizations'] })
  const org = (store.organizations || []).find((o) => o.id === orgId)
  const started = Date.now()
  const result = await syncOrgCrmToMeilisearch(orgId)
  return {
    organizationId: orgId,
    organizationName: org?.name || null,
    ...result,
    connection,
    durationMs: Date.now() - started,
  }
}

export async function backfillAllMeilisearch(options = {}) {
  if (!meiliEnabled()) throw new Error('Meilisearch not configured')
  const connection = await testMeilisearchConnection()
  if (!connection.ok) throw new Error(connection.error || 'Meilisearch unreachable')

  const started = Date.now()
  const result = await syncAllOrganizationsToMeilisearch()
  return { ...result, connection, durationMs: Date.now() - started }
}

export async function verifyMeilisearchBackfill({ orgId = null } = {}) {
  if (!meiliEnabled()) {
    return { ok: false, error: 'meilisearch_disabled', checks: [] }
  }

  const connection = await testMeilisearchConnection()
  const stats = await meilisearchIndexStats()
  const store = await readStore({ only: ['organizations', 'users', 'organizationMemberships'] })
  const orgs = orgId
    ? (store.organizations || []).filter((o) => o.id === orgId)
    : store.organizations || []

  const checks = []
  let ok = connection.ok

  for (const org of orgs) {
    if (!org?.id) continue
    const entries = await loadOrgPipelineEntries(org.id, store)
    const expected = countExpectedMeilisearchDocs(entries)
    const indexed = await countIndexedDocsForOrg(org.id)
    const rowOk = indexed !== null && indexed >= expected
    if (!rowOk) ok = false
    checks.push({
      organizationId: org.id,
      organizationName: org.name || null,
      expected,
      indexed,
      shardLeads: entries.length,
      ok: rowOk,
    })
  }

  return { ok, connection, stats, checks }
}
