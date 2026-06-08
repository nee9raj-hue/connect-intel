import { requireUser } from '../auth.js'
import { listPipelineSavedEntries } from '../organizations.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import { periodStart } from '../dashboardPeriod.js'
import { buildMyDayDashboard } from '../myDayDashboard.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const timeZone = resolveTimeZone(user, new URL(req.url || '', 'http://localhost').searchParams.get('tz'))
  const since = periodStart('week', timeZone)

  const { pipelineStore, visible } = await loadPipelineStoreContext(user, { mergeMonolithCrm: true })
  const store = { ...pipelineStore, savedLeads: visible }
  const entries = listPipelineSavedEntries(store, user)

  const myDay = buildMyDayDashboard(store, user, entries, { timeZone, since })

  return sendJson(res, 200, { myDay })
}
