import { refreshAccessToken } from './gmailOAuth.js'

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

export async function listPrimaryCalendarEvents(refreshToken, { timeMin, timeMax, maxResults = 250 } = {}) {
  const accessToken = await refreshAccessToken(refreshToken)
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
      return {
        googleEventId: item.id,
        title: String(item.summary || '(No title)').slice(0, 200),
        scheduledAt,
        endAt,
        location: String(item.location || '').slice(0, 300),
        htmlLink: item.htmlLink || null,
        source: 'google',
      }
    })
    .filter(Boolean)
}

export async function createPrimaryCalendarEvent(refreshToken, meeting, lead) {
  const accessToken = await refreshAccessToken(refreshToken)
  const start = new Date(meeting.scheduledAt)
  const durationMinutes = Number(meeting.durationMinutes) || 30
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  const leadName = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead'
  const description = [
    meeting.notes,
    lead?.company ? `Company: ${lead.company}` : null,
    lead?.email ? `Email: ${lead.email}` : null,
    lead?.phone ? `Phone: ${lead.phone}` : null,
    'Created from Connect Intel CRM',
  ]
    .filter(Boolean)
    .join('\n')

  const body = {
    summary: `${meeting.title} · ${leadName}`,
    description,
    location: meeting.location || undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: {
        connectIntelLeadId: String(lead?.id || ''),
        connectIntelMeetingId: String(meeting.id || ''),
      },
    },
  }

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

export function googleEventsToCalendarDtos(events, user) {
  const now = Date.now()
  return events.map((ev) => {
    const atMs = new Date(ev.scheduledAt).getTime()
    const endMs = ev.endAt ? new Date(ev.endAt).getTime() : null
    return {
      id: `google-${ev.googleEventId}`,
      kind: 'google',
      source: 'google',
      scheduledAt: ev.scheduledAt,
      endAt: ev.endAt,
      timeStatus: atMs < now - 5 * 60 * 1000 ? 'past' : 'upcoming',
      title: ev.title,
      leadId: null,
      leadName: null,
      company: null,
      location: ev.location || '',
      htmlLink: ev.htmlLink || null,
      assignedToUserId: user.id,
      assignedToName: user.name || 'You',
      googleEventId: ev.googleEventId,
    }
  })
}
