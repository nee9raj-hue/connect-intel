import { requireUser } from '../auth.js'
import { buildActivityFeed } from '../crmWorkflow.js'
import { listPipelineSavedEntries, resolveOrgRole } from '../organizations.js'
import { sanitizeCrmForTenant } from '../tenantIsolation.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'

const ACTIVITY_FEED_MAX_LEADS = 600

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const { pipelineStore } = await loadPipelineStoreContext(user)

  const params = new URL(req.url || '', 'http://localhost').searchParams
  let memberUserId = params.get('userId') || null
  const activityType = String(params.get('type') || '').trim().toLowerCase() || null
  const { orgRole } = resolveOrgRole(user, pipelineStore)
  const isAdmin = user.isOrgAdmin || orgRole === 'org_admin'
  if (memberUserId && !isAdmin && String(memberUserId) !== String(user.id)) {
    memberUserId = String(user.id)
  }
  let rows = listPipelineSavedEntries(pipelineStore, user)
  if (memberUserId) {
    const mid = String(memberUserId)
    rows = rows.filter(
      (e) => String(e.assignedToUserId || e.savedByUserId || e.userId || '') === mid
    )
  }
  rows = rows
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, ACTIVITY_FEED_MAX_LEADS)

  const entries = rows.map((entry) => ({
    ...entry,
    crm: sanitizeCrmForTenant(pipelineStore, user, entry.crm),
  }))

  let activities = buildActivityFeed(entries, { limit: 120 })
  if (activityType) {
    activities = activities.filter((a) => String(a.type || '').toLowerCase() === activityType)
  }

  return sendJson(res, 200, {
    activities: activities.slice(0, 80),
  })
}
