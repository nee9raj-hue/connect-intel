import { getUserCrmGmail } from './crmUserGmail.js'
import {
  createPrimaryCalendarEvent,
  googleEventsToCalendarDtos,
  listPrimaryCalendarEvents,
  oauthHasCalendarScope,
} from './googleCalendar.js'
import { readStore, updateStorePartial } from './store.js'

const MS_DAY = 24 * 60 * 60 * 1000

export function getGoogleCalendarSyncStatus(user) {
  const oauth = getUserCrmGmail(user)
  const imp = user?.googleCalendarImport || null
  return {
    gmailConnected: Boolean(oauth),
    mailbox: oauth?.email || null,
    calendarScope: oauth ? oauthHasCalendarScope(oauth) : false,
    calendarSyncEnabled: Boolean(user?.calendarSyncEnabled),
    lastSyncAt: imp?.lastSyncAt || null,
    importedCount: imp?.events?.length || 0,
  }
}

export async function syncGoogleCalendarForUser(user, { fromMs, toMs } = {}) {
  const oauth = getUserCrmGmail(user)
  if (!oauth) {
    return { ok: false, error: 'Connect work Gmail first (same Google account is used for Calendar).' }
  }
  if (!oauthHasCalendarScope(oauth)) {
    return {
      ok: false,
      needsCalendarConsent: true,
      error: 'Google Calendar permission is required. Use “Connect Google Calendar” to grant access.',
    }
  }

  const now = Date.now()
  const rangeStart = fromMs ?? now - 90 * MS_DAY
  const rangeEnd = toMs ?? now + 365 * MS_DAY

  const events = await listPrimaryCalendarEvents(oauth.refreshToken, {
    timeMin: rangeStart,
    timeMax: rangeEnd,
  })

  const payload = {
    lastSyncAt: new Date().toISOString(),
    events: events.slice(0, 400),
    range: {
      from: new Date(rangeStart).toISOString(),
      to: new Date(rangeEnd).toISOString(),
    },
  }

  await updateStorePartial(['users'], (draft) => {
    const row = draft.users.find((u) => u.id === user.id)
    if (!row) throw new Error('User not found')
    row.googleCalendarImport = payload
    row.calendarSyncEnabled = true
    return draft
  })

  return { ok: true, imported: events.length, lastSyncAt: payload.lastSyncAt }
}

const DEFAULT_CALENDAR_SYNC_AGE_MS = 12 * 60 * 1000

/** Import Google Calendar when cache is older than maxAgeMs (non-blocking errors). */
export async function syncGoogleCalendarIfStale(user, { maxAgeMs = DEFAULT_CALENDAR_SYNC_AGE_MS } = {}) {
  if (!user?.calendarSyncEnabled && !getUserCrmGmail(user)) {
    return { synced: false, skipped: 'not_configured' }
  }
  const oauth = getUserCrmGmail(user)
  if (!oauth || !oauthHasCalendarScope(oauth)) {
    return { synced: false, skipped: 'no_calendar_scope' }
  }

  const lastSyncAt = user?.googleCalendarImport?.lastSyncAt
  if (lastSyncAt && Date.now() - new Date(lastSyncAt).getTime() < maxAgeMs) {
    return { synced: false, skipped: 'fresh', lastSyncAt }
  }

  const result = await syncGoogleCalendarForUser(user)
  if (!result.ok) return { synced: false, error: result.error, needsCalendarConsent: result.needsCalendarConsent }
  return { synced: true, imported: result.imported, lastSyncAt: result.lastSyncAt }
}

export function mergeGoogleCalendarEvents(crmEvents, user, { fromMs, toMs } = {}) {
  if (!user?.calendarSyncEnabled || !user?.googleCalendarImport?.events?.length) {
    return crmEvents
  }
  const rangeStart = fromMs ?? Date.now() - 90 * MS_DAY
  const rangeEnd = toMs ?? Date.now() + 365 * MS_DAY
  const googleDtos = googleEventsToCalendarDtos(user.googleCalendarImport.events, user).filter((ev) => {
    const t = new Date(ev.scheduledAt).getTime()
    return t >= rangeStart && t <= rangeEnd
  })
  return [...crmEvents, ...googleDtos].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  )
}

export async function pushCrmMeetingToGoogle(user, meeting, lead) {
  if (!user?.calendarSyncEnabled) return { pushed: false, skipped: true }
  const oauth = getUserCrmGmail(user)
  if (!oauth || !oauthHasCalendarScope(oauth)) {
    return { pushed: false, skipped: true, needsCalendarConsent: true }
  }
  if (meeting.googleEventId) return { pushed: false, skipped: true, alreadyLinked: true }

  try {
    const created = await createPrimaryCalendarEvent(oauth.refreshToken, meeting, lead)
    return { pushed: true, ...created }
  } catch (error) {
    return { pushed: false, error: error.message || 'Google Calendar create failed' }
  }
}
