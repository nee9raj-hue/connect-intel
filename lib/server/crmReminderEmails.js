import { resolveTimeZone } from '../calendarLocale.js'
import { sendOrgNotificationEmail } from './email.js'
import { collectUpcomingReminders, collectCalendarEvents } from './crmWorkflow.js'
import { listCalendarPipelineEntries, getOrganization } from './organizations.js'
import { updateStorePartial, readStore } from './store.js'
import { loadPipelineStoreContext } from './pipelineShard.js'

const REMINDER_BEFORE_MS = 30 * 60 * 1000
const REMINDER_WINDOW_MS = 12 * 60 * 1000
const MORNING_START_HOUR = 7
const MORNING_END_HOUR = 9

function localParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

function dispatchKey(kind, userId, item) {
  const when = item.scheduledAt || item.reminderDueAt || ''
  const id = item.taskId || item.meetingId || item.leadId || 'fu'
  return `${kind}:${userId}:${id}:${when.slice(0, 16)}`
}

function hasDispatch(user, key) {
  return Boolean(user?.crmReminderDispatches?.[key])
}

async function recordDispatch(userId, key) {
  await updateStorePartial(['users'], (draft) => {
    const row = draft.users.find((u) => u.id === userId)
    if (!row) return draft
    const prev = row.crmReminderDispatches && typeof row.crmReminderDispatches === 'object'
      ? row.crmReminderDispatches
      : {}
    const next = { ...prev, [key]: new Date().toISOString() }
    const keys = Object.keys(next)
    if (keys.length > 300) {
      for (const k of keys.slice(0, keys.length - 300)) delete next[k]
    }
    row.crmReminderDispatches = next
    return draft
  })
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

async function sendReminderEmail({ user, organizationId, subject, html, text }) {
  if (!user?.email) return { sent: false, skipped: 'no_email' }
  return sendOrgNotificationEmail({
    to: user.email,
    subject,
    html,
    text,
    organizationId,
    senderName: 'Connect Intel',
  })
}

function buildMorningDigestHtml(items, orgName) {
  const rows = items
    .map(
      (i) =>
        `<li><strong>${i.title}</strong> — ${formatWhen(i.scheduledAt)}${
          i.leadName ? ` · ${i.leadName}` : ''
        }</li>`
    )
    .join('')
  return `<p>Good morning${orgName ? ` from ${orgName}` : ''} — here is your schedule for today:</p><ul>${rows}</ul><p>Open Connect Intel → Calendar to view details.</p>`
}

function buildImminentHtml(item) {
  const label = item.kind === 'meeting' ? 'Meeting' : item.kind === 'task' ? 'Task' : 'Follow-up'
  return `<p><strong>${label} in about 30 minutes</strong></p><p>${item.title}${
    item.leadName ? `<br/>Lead: ${item.leadName}` : ''
  }<br/>When: ${formatWhen(item.scheduledAt)}</p><p>Open Connect Intel → Calendar for details.</p>`
}

export async function dispatchUserReminderEmails(user, store) {
  if (!user?.email) return { morning: 0, imminent: 0 }

  const entries = listCalendarPipelineEntries(store, user)
  const tz = resolveTimeZone(user)
  const now = new Date()
  const local = localParts(now, tz)
  const org = user.organizationId ? getOrganization(store, user.organizationId) : null
  const orgName = org?.name || user.organizationName || null

  let morningSent = 0
  let imminentSent = 0

  const todayEvents = collectCalendarEvents(entries, user, {
    fromMs: now.getTime() - 60 * 60 * 1000,
    toMs: now.getTime() + 36 * 60 * 60 * 1000,
  }).filter((e) => {
    if (e.timeStatus !== 'upcoming') return false
    const p = localParts(new Date(e.scheduledAt), tz)
    return p.dateKey === local.dateKey
  })

  if (
    todayEvents.length &&
    local.hour >= MORNING_START_HOUR &&
    local.hour < MORNING_END_HOUR
  ) {
    const morningKey = `morning:${user.id}:${local.dateKey}`
    if (!hasDispatch(user, morningKey)) {
      const html = buildMorningDigestHtml(todayEvents, orgName)
      const text = `Today's schedule (${todayEvents.length} items). Open Connect Intel → Calendar.`
      const result = await sendReminderEmail({
        user,
        organizationId: user.organizationId,
        subject: `Today's schedule — ${todayEvents.length} item${todayEvents.length === 1 ? '' : 's'}`,
        html,
        text,
      })
      if (result?.sent) {
        await recordDispatch(user.id, morningKey)
        morningSent = 1
      }
    }
  }

  const reminders = collectUpcomingReminders(entries, user, { withinHours: 48 })
  for (const item of reminders) {
    const at = new Date(item.scheduledAt).getTime()
    const remindAt = at - REMINDER_BEFORE_MS
    const nowMs = now.getTime()
    if (nowMs < remindAt || nowMs > remindAt + REMINDER_WINDOW_MS) continue

    const key = dispatchKey('30m', user.id, item)
    if (hasDispatch(user, key)) continue

    const html = buildImminentHtml(item)
    const label = item.kind === 'meeting' ? 'Meeting' : item.kind === 'task' ? 'Task' : 'Follow-up'
    const result = await sendReminderEmail({
      user,
      organizationId: user.organizationId,
      subject: `${label} in 30 min: ${item.title}`,
      html,
      text: `${label} at ${formatWhen(item.scheduledAt)} — ${item.title}`,
    })
    if (result?.sent) {
      await recordDispatch(user.id, key)
      imminentSent += 1
    }
  }

  return { morning: morningSent, imminent: imminentSent }
}

/** Cron: reminder emails for all users with upcoming calendar items. */
export async function processAllCrmReminderEmails() {
  const store = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const users = (store.users || []).filter((u) => u.email && !u.disabled)
  let morning = 0
  let imminent = 0
  let usersChecked = 0

  for (const user of users) {
    try {
      const { pipelineStore } = await loadPipelineStoreContext(user)
      const merged = { ...store, savedLeads: pipelineStore.savedLeads }
      const fresh = store.users.find((u) => u.id === user.id) || user
      const result = await dispatchUserReminderEmails(fresh, merged)
      morning += result.morning || 0
      imminent += result.imminent || 0
      usersChecked += 1
    } catch (err) {
      console.warn('crm reminder email failed for user', user.id, err?.message || err)
    }
  }

  return { usersChecked, morning, imminent }
}
