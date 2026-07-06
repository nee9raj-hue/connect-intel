import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { defaultDashboardLayout, normalizeDashboardLayout } from '../../dashboardLayout.js'
import { recordAuditEvent } from '../auditEvents.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const store = await readStore({ only: ['users'] })
    const row = store.users?.find((u) => u.id === user.id)
    const layout = normalizeDashboardLayout(row?.dashboardLayout)
    return sendJson(res, 200, { layout, source: row?.dashboardLayout ? 'server' : 'default' })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req) || {}
    const layout = normalizeDashboardLayout(body.layout)
    if (!Array.isArray(body.layout)) {
      return sendJson(res, 400, { error: 'layout array is required' })
    }

    await updateStore((draft) => {
      const row = draft.users?.find((u) => u.id === user.id)
      if (!row) throw new Error('User not found')
      row.dashboardLayout = layout
      row.dashboardLayoutUpdatedAt = new Date().toISOString()
      return draft
    })

    void recordAuditEvent({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'dashboard.layout_updated',
      resourceType: 'user',
      resourceId: user.id,
      outcome: 'success',
      metadata: { widgetCount: layout.length },
    }).catch(() => {})

    return sendJson(res, 200, { layout, source: 'server' })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
