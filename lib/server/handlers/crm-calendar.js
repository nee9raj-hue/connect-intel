import { requireUser } from '../auth.js'
import { collectCalendarEvents, collectUpcomingReminders } from '../crmWorkflow.js'
import { mergeGoogleCalendarEvents, getGoogleCalendarSyncStatus, syncGoogleCalendarIfStale } from '../googleCalendarSync.js'
import { listCalendarPipelineEntries, listTeamMembers } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'

const MS_DAY = 86400000

/** Session user has orgRole; DB user has fresh Google import fields — merge both for calendar. */
function calendarActor(sessionUser, dbUser) {
  return {
    ...sessionUser,
    googleCalendarImport: dbUser?.googleCalendarImport ?? sessionUser.googleCalendarImport,
    calendarSyncEnabled: dbUser?.calendarSyncEnabled ?? sessionUser.calendarSyncEnabled,
    crmGmailOAuth: dbUser?.crmGmailOAuth ?? sessionUser.crmGmailOAuth,
  }
}

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

  const { pipelineStore } = await loadPipelineStoreContext(user)
  const entries = listCalendarPipelineEntries(pipelineStore, user)
  const { fromMs, toMs } = parseRange(req)

  const store = await readStore({ only: ['users'] })
  const dbUser = store.users.find((u) => u.id === user.id) || user
  const actor = calendarActor(user, dbUser)

  // Never block the calendar read on Google sync — user can tap “Sync now”.
  void syncGoogleCalendarIfStale(dbUser).catch((err) => {
    console.warn('calendar background sync failed:', err?.message || err)
  })

  const crmEvents = collectCalendarEvents(entries, actor, { fromMs, toMs })
  const events = mergeGoogleCalendarEvents(crmEvents, actor, { fromMs, toMs })

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const includeReminders = params.get('includeReminders') === '1'
  const reminders = includeReminders
    ? collectUpcomingReminders(entries, actor, { withinHours: 168 })
    : []

  const googleCalendar = getGoogleCalendarSyncStatus(actor)

  const members =
    user.organizationId && user.accountType === 'company'
      ? listTeamMembers(pipelineStore, user.organizationId).map((m) => ({
          userId: m.userId,
          name: m.name,
        }))
      : []

  return sendJson(res, 200, {
    events,
    reminders,
    members,
    googleCalendar,
    range: {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
    },
    count: events.length,
  })
}
