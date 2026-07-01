import { readStore } from './store.js'
import { refreshDashboardSnapshotsForUser } from './dashboardSnapshots.js'

/** Rebuild dashboard snapshots for all orgs (cron / manual warm). */
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
      const result = await refreshDashboardSnapshotsForUser(admin, 'week')
      results.push({
        orgId: org.id,
        ok: true,
        entryCount: result?.entryCount ?? 0,
      })
    } catch (err) {
      results.push({ orgId: org.id, ok: false, error: err?.message || 'warm_failed' })
    }
  }

  return { orgCount: orgs.length, results }
}
