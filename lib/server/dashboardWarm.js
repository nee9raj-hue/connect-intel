import { readStore } from './store.js'
import { refreshDashboardSnapshotsForUser } from './dashboardSnapshots.js'
import { refreshMarketingSnapshotForOrg } from './marketingSnapshots.js'

/** Rebuild dashboard + marketing snapshots for all orgs (cron / manual warm). */
export async function warmAllDashboardSnapshots({ orgId = null } = {}) {
  const store = await readStore({ only: ['organizations', 'users'] })
  const orgs = orgId
    ? (store.organizations || []).filter((o) => o.id === orgId)
    : store.organizations || []

  const results = []
  for (const org of orgs) {
    const admin =
      (store.users || []).find(
        (u) => u.organizationId === org.id && (u.orgRole === 'org_admin' || u.isOrgAdmin)
      ) || (store.users || []).find((u) => u.organizationId === org.id)

    if (!admin) {
      results.push({ orgId: org.id, skipped: true, reason: 'no_user' })
      continue
    }

    try {
      const [dashboardResult, marketingResult] = await Promise.all([
        refreshDashboardSnapshotsForUser(admin, 'week'),
        refreshMarketingSnapshotForOrg(org.id, admin.id, { period: '30d' }),
      ])
      results.push({
        orgId: org.id,
        ok: true,
        entryCount: dashboardResult?.entryCount ?? 0,
        marketingSnapshot: Boolean(marketingResult),
      })
    } catch (err) {
      results.push({ orgId: org.id, ok: false, error: err?.message || 'warm_failed' })
    }
  }

  return { orgCount: orgs.length, results }
}
