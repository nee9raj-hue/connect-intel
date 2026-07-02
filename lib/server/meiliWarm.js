import { readStore } from './store.js'
import { resolveOrganization } from './orgCrmClean.js'
import { meiliEnabled } from './meilisearch/client.js'
import {
  backfillMeilisearchForOrg,
  verifyMeilisearchBackfill,
} from './meilisearchBackfill.js'

function resolveOrgIds(store, { orgId = null, nameQuery = null } = {}) {
  if (orgId) return [orgId]
  if (nameQuery) {
    const org = resolveOrganization(store, { nameQuery })
    return org?.id ? [org.id] : []
  }
  return (store.organizations || []).map((o) => o.id).filter(Boolean)
}

/** Verify + backfill Meilisearch for one or all orgs (production cron / post-deploy). */
export async function warmAllMeilisearch({ orgId = null, nameQuery = null } = {}) {
  if (!meiliEnabled()) {
    return { skipped: true, reason: 'meilisearch_disabled', orgCount: 0, results: [] }
  }

  const store = await readStore({ only: ['organizations'] })
  const orgIds = resolveOrgIds(store, { orgId, nameQuery })
  const results = []

  for (const oid of orgIds) {
    const org = (store.organizations || []).find((o) => o.id === oid)
    try {
      const verifyBefore = await verifyMeilisearchBackfill({ orgId: oid })
      let backfill = null
      if (!verifyBefore.ok) {
        backfill = await backfillMeilisearchForOrg(oid)
      }
      const verifyAfter = await verifyMeilisearchBackfill({ orgId: oid })
      const check = verifyAfter.checks?.[0]
      results.push({
        orgId: oid,
        organizationName: org?.name || null,
        ok: verifyAfter.ok,
        indexed: check?.indexed ?? backfill?.indexed ?? null,
        expected: check?.expected ?? null,
        backfilled: Boolean(backfill),
      })
    } catch (err) {
      results.push({
        orgId: oid,
        organizationName: org?.name || null,
        ok: false,
        error: err?.message || 'meili_warm_failed',
      })
    }
  }

  return {
    orgCount: orgIds.length,
    ok: results.every((r) => r.ok),
    results,
  }
}
