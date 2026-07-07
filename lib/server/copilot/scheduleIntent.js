const MS_DAY = 86400000

function startOfLocalDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(9, 0, 0, 0)
  return x
}

function nextWeekday(dayIndex, from = new Date()) {
  const d = new Date(from)
  const diff = (dayIndex + 7 - d.getDay()) % 7 || 7
  d.setDate(d.getDate() + diff)
  return startOfLocalDay(d)
}

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

export function parseDueFromMessage(message, now = new Date()) {
  const lower = String(message || '').toLowerCase()

  if (/\btoday\b/.test(lower)) {
    const d = new Date(now)
    d.setHours(17, 0, 0, 0)
    if (d <= now) d.setDate(d.getDate() + 1)
    return d.toISOString()
  }

  if (/\btomorrow\b/.test(lower)) {
    const d = startOfLocalDay(new Date(now.getTime() + MS_DAY))
    return d.toISOString()
  }

  const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/)
  if (inDays) {
    const n = Math.min(parseInt(inDays[1], 10), 90)
    return startOfLocalDay(new Date(now.getTime() + n * MS_DAY)).toISOString()
  }

  for (const [name, idx] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b(next\\s+)?${name}\\b`).test(lower)) {
      return nextWeekday(idx, now).toISOString()
    }
  }

  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/)
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10)
    const min = parseInt(timeMatch[2] || '0', 10)
    const ampm = timeMatch[3]
    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    const d = /\btomorrow\b/.test(lower)
      ? startOfLocalDay(new Date(now.getTime() + MS_DAY))
      : startOfLocalDay(now)
    d.setHours(hour, min, 0, 0)
    if (d <= now && !/\btomorrow\b/.test(lower)) d.setDate(d.getDate() + 1)
    return d.toISOString()
  }

  return startOfLocalDay(new Date(now.getTime() + MS_DAY)).toISOString()
}

export function parseMeetingFromMessage(message, now = new Date()) {
  const scheduledAt = parseDueFromMessage(message, now)
  const lower = String(message || '').toLowerCase()
  let type = 'call'
  if (/\bvideo\b|\bzoom\b|\bteams\b/.test(lower)) type = 'video'
  if (/\bfield visit\b|\bsite visit\b/.test(lower)) type = 'field_visit'

  const durationMatch = lower.match(/\b(\d+)\s*(min|minute)/)
  const durationMinutes = durationMatch ? Math.min(parseInt(durationMatch[1], 10), 240) : 30

  return { scheduledAt, durationMinutes, type }
}

export function parseTaskTitle(message) {
  let title = String(message || '').trim()
  title = title
    .replace(/^(create|add)\s+(a\s+)?task[:\s-]*/i, '')
    .replace(/^remind me to\s+/i, '')
    .replace(/\b(tomorrow|today|next\s+\w+|in\s+\d+\s+days?)\b/gi, '')
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .trim()

  if (!title || title.length < 3) title = 'Follow up'
  return title.slice(0, 200)
}

export function buildEmailAgenda(message, leadContext) {
  const raw = String(message || '').trim()
  const stripped = raw
    .replace(/^(draft|write|compose)\s+(a\s+)?(follow.?up\s+)?email[:\s-]*/i, '')
    .replace(/^email\s+(to|for)\s+/i, '')
    .trim()

  const company = leadContext?.company || 'the prospect'
  const name = leadContext?.name || 'the contact'
  const base =
    stripped.length >= 8
      ? stripped
      : `Follow up with ${name} at ${company} — check interest and propose a short call.`

  return base.slice(0, 500)
}
