import { requireUser } from '../auth.js'
import { collectCalendarEvents, collectUpcomingReminders } from '../crmWorkflow.js'
import { listPipelineSavedEntries, listTeamMembers } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

const MS_DAY = 86400000

function parseRange(req) {
  const params = new URL(req.url || '', 'http://localhost').searchParams
  const now = Date.now()
  const fromParam = params.get('from')
  const toParam = params.get('to')
  const fromMs = fromParam ? new Date(fromParam).getTime() : now - 90 * MS_DAY
  const toMs = toParam ? new Date(toParam).getTime() : now + 365 * MS_DAY
  return {
    fromMs: Number.isNaN(fromMs) ? now - 90 * MS_DAY : fromMs,
    toMs: Number.isNaN(toMs) ? now + 365 * MS_DAY : toMs,
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const entries = listPipelineSavedEntries(store, user)
  const { fromMs, toMs } = parseRange(req)

  const events = collectCalendarEvents(entries, user, { fromMs, toMs })
  const reminders = collectUpcomingReminders(entries, user, { withinHours: 168 })

  const members =
    user.organizationId && user.accountType === 'company'
      ? listTeamMembers(store, user.organizationId).map((m) => ({
          userId: m.userId,
          name: m.name,
        }))
      : []

  return sendJson(res, 200, {
    events,
    reminders,
    members,
    range: {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
    },
    count: events.length,
  })
}
