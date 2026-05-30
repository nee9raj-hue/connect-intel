import { requireUser } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { workspaceFeatureEnabled } from '../workspaceFeatures.js'
import {
  getOrgFieldVisitExpenseSettings,
  setOrgFieldVisitExpenseSettings,
} from '../fieldVisitExpenseSettings.js'
import {
  listFieldVisitExpenseRows,
  summarizeFieldVisitRows,
} from '../fieldVisitExpensesQuery.js'

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const { accountType } = resolveOrgRole(user, store)
  const organizationId =
    accountType === 'company' && user.organizationId ? user.organizationId : null

  if (!organizationId) {
    return sendJson(res, 400, { error: 'Field visit expenses require a company workspace' })
  }

  const org = store.organizations.find((o) => o.id === organizationId)
  if (!workspaceFeatureEnabled(org, 'fieldVisitExpenses')) {
    return sendJson(res, 403, { error: 'Field visit expenses are not enabled for this workspace' })
  }

  if (req.method === 'GET') {
    const url = new URL(req.url || '', 'http://local')
    const month = String(url.searchParams.get('month') || currentMonthKey()).trim()
    const assigneeUserId = String(url.searchParams.get('userId') || '').trim() || null

    if (assigneeUserId && assigneeUserId !== user.id && !user.isOrgAdmin) {
      return sendJson(res, 403, { error: 'You can only view your own field expenses' })
    }

    const rows = listFieldVisitExpenseRows(store, user, {
      month,
      assigneeUserId: assigneeUserId || (!user.isOrgAdmin ? user.id : null),
      organizationId,
    })
    const totals = summarizeFieldVisitRows(rows)
    const settings = getOrgFieldVisitExpenseSettings(store, organizationId)

    return sendJson(res, 200, {
      month,
      visits: rows,
      totals,
      settings,
      canViewTeam: Boolean(user.isOrgAdmin),
    })
  }

  if (req.method === 'PATCH') {
    if (!user.isOrgAdmin) {
      return sendJson(res, 403, { error: 'Only company admins can change expense rates' })
    }

    const body = getBody(req) || {}
    let settings
    await updateStore((draft) => {
      const patch = {}
      if (body.bikeRatePerKm !== undefined) patch.bikeRatePerKm = body.bikeRatePerKm
      if (body.carRatePerKm !== undefined) patch.carRatePerKm = body.carRatePerKm
      if (body.defaultStartLocation !== undefined) patch.defaultStartLocation = body.defaultStartLocation
      if (body.currency !== undefined) patch.currency = body.currency
      settings = setOrgFieldVisitExpenseSettings(draft, organizationId, patch)
      return draft
    })
    return sendJson(res, 200, { settings })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
