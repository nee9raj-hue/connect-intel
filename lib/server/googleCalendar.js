import { refreshAccessToken, accessTokenFromRefreshResult } from './gmailOAuth.js'

async function calendarAccessToken(refreshToken) {
  return accessTokenFromRefreshResult(await refreshAccessToken(refreshToken))
}

export function oauthHasCalendarScope(oauth) {
  if (!oauth?.refreshToken) return false
  const scope = String(oauth.scope || '')
  return scope.includes('calendar.events') || scope.includes('/auth/calendar')
}

function parseGoogleEventTime(value) {
  if (!value) return null
  if (value.dateTime) return value.dateTime
  if (value.date) return `${value.date}T00:00:00.000Z`
  return null
}

function leadDisplayName(lead) {
  return [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead'
}

function buildCrmEventBody({ kind, item, lead }) {
  const leadName = leadDisplayName(lead)
  const isTask = kind === 'task'
  const title = String(item.title || (isTask ? 'Task' : 'Meeting')).slice(0, 200)
  const description = [
    isTask ? 'Connect Intel CRM task' : item.notes,
    lead?.company ? `Company: ${lead.company}` : null,
    lead?.email ? `Email: ${lead.email}` : null,
    lead?.phone ? `Phone: ${lead.phone}` : null,
    'Created from Connect Intel CRM',
  ]
    .filter(Boolean)
    .join('\n')

  const startRaw = isTask ? item.dueAt : item.scheduledAt
  const start = new Date(startRaw)
  const durationMinutes = isTask ? 30 : Number(item.durationMinutes) || 30
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

  const body = {
    summary: `${title} · ${leadName}`,
    description,
    location: item.location || undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: {
        connectIntelLeadId: String(lead?.id || ''),
        ...(isTask
          ? { connectIntelTaskId: String(item.id || '') }
          : { connectIntelMeetingId: String(item.id || '') }),
      },
    },
  }
  return body
}

export async function listPrimaryCalendarEvents(refreshToken, { timeMin, timeMax, maxResults = 250 } = {}) {
  const accessToken = await calendarAccessToken(refreshToken)
  const params = new URLSearchParams({
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(Math.min(maxResults, 250)),
  })

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || data.error || 'Google Calendar list failed')
  }

  return (data.items || [])
    .filter((item) => item.status !== 'cancelled')
    .map((item) => {
      const scheduledAt = parseGoogleEventTime(item.start)
      const endAt = parseGoogleEventTime(item.end)
      if (!scheduledAt) return null
      const priv = item.extendedProperties?.private || {}
      return {
        googleEventId: item.id,
        title: String(item.summary || '(No title)').slice(0, 200),
        scheduledAt,
        endAt,
        location: String(item.location || '').slice(0, 300),
        htmlLink: item.htmlLink || null,
        source: 'google',
        connectIntelLeadId: priv.connectIntelLeadId || null,
        connectIntelMeetingId: priv.connectIntelMeetingId || null,
        connectIntelTaskId: priv.connectIntelTaskId || null,
      }
    })
    .filter(Boolean)
}

async function postCalendarEvent(accessToken, body) {
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || data.error || 'Google Calendar create failed')
  }
  return { googleEventId: data.id, htmlLink: data.htmlLink || null }
}

export async function createPrimaryCalendarEvent(refreshToken, meeting, lead) {
  const accessToken = await calendarAccessToken(refreshToken)
  return postCalendarEvent(accessToken, buildCrmEventBody({ kind: 'meeting', item: meeting, lead }))
}

export async function createPrimaryCalendarTaskEvent(refreshToken, task, lead) {
  const accessToken = await calendarAccessToken(refreshToken)
  return postCalendarEvent(accessToken, buildCrmEventBody({ kind: 'task', item: task, lead }))
}

export async function updatePrimaryCalendarEvent(refreshToken, googleEventId, { kind, item, lead }) {
  if (!googleEventId) return null
  const accessToken = await calendarAccessToken(refreshToken)
  const body = buildCrmEventBody({ kind, item, lead })
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || data.error || 'Google Calendar update failed')
  }
  return { googleEventId: data.id, htmlLink: data.htmlLink || null }
}

export async function deletePrimaryCalendarEvent(refreshToken, googleEventId) {
  if (!googleEventId) return { deleted: false, skipped: true }
  const accessToken = await calendarAccessToken(refreshToken)
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  if (response.status === 404 || response.status === 410) {
    return { deleted: true, alreadyGone: true }
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error?.message || data.error || 'Google Calendar delete failed')
  }
  return { deleted: true }
}

export function googleEventsToCalendarDtos(events, user) {
  const now = Date.now()
  return events.map((ev) => {
    const atMs = new Date(ev.scheduledAt).getTime()
    return {
      id: `google-${ev.googleEventId}`,
      kind: 'google',
      source: 'google',
      scheduledAt: ev.scheduledAt,
      endAt: ev.endAt,
      timeStatus: atMs < now - 5 * 60 * 1000 ? 'past' : 'upcoming',
      title: ev.title,
      leadId: ev.connectIntelLeadId || null,
      leadName: null,
      company: null,
      location: ev.location || '',
      htmlLink: ev.htmlLink || null,
      assignedToUserId: user.id,
      assignedToName: user.name || 'You',
      googleEventId: ev.googleEventId,
      connectIntelMeetingId: ev.connectIntelMeetingId || null,
      connectIntelTaskId: ev.connectIntelTaskId || null,
    }
  })
}
