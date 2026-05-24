import { useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/crmUiConstants'

const REMINDER_MS = 30 * 60 * 1000
const POLL_MS = 60 * 1000

export function useCrmReminders(enabled) {
  const notifiedRef = useRef(new Set())

  useEffect(() => {
    if (!enabled) return undefined

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    const tick = async () => {
      try {
        const data = await api.getCrmCalendar('', { silent: true })
        const now = Date.now()

        for (const item of data.reminders || []) {
          const at = new Date(item.scheduledAt).getTime()
          const remindAt = at - REMINDER_MS
          const key = `${item.leadId}:${item.meetingId || item.taskId || 'follow'}:${item.scheduledAt}`

          if (now < remindAt || now > at + 5 * 60 * 1000) continue
          if (item.reminderSentAt || notifiedRef.current.has(key)) continue

          notifiedRef.current.add(key)
          const title =
            item.kind === 'meeting'
              ? `Upcoming: ${item.title}`
              : item.kind === 'task'
                ? `Task due: ${item.title}`
                : `Follow up: ${item.leadName}`
          const body = `${item.leadName} · ${formatDateTime(item.scheduledAt)}`

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(title, { body, tag: key })
          }

          if (item.meetingId) {
            api.ackMeetingReminder(item.leadId, item.meetingId, { silent: true }).catch(() => {})
          }
        }
      } catch {
        // ignore polling errors
      }
    }

    tick()
    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
  }, [enabled])
}
