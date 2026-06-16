import { requireUser } from '../auth.js'
import { buildCrmNotifications } from '../crmNotifications.js'
import { syncUserEmailThreadsIfStale } from '../crmEmailAutoSync.js'
import { isCrmInboundEmailEnabled } from '../crmInboundEmail.js'
import { syncGoogleCalendarIfStale } from '../googleCalendarSync.js'
import { dispatchUserReminderEmails } from '../crmReminderEmails.js'
import { readStore, updateStorePartial } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreForNotifications } from '../pipelineNotificationLoad.js'

const NOTIFICATION_META_COLLECTIONS = [
  'users',
  'organizations',
  'organizationMemberships',
  'teamNotes',
  'teamTasks',
  'chithiChannels',
  'chithiMessages',
]

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const since = params.get('since') || null

  try {
    let [{ pipelineStore }, metaStore] = await Promise.all([
      loadPipelineStoreForNotifications(user, { since }),
      readStore({ only: NOTIFICATION_META_COLLECTIONS }),
    ])

    let freshUser = metaStore.users.find((u) => u.id === user.id) || user
    let store = { ...metaStore, savedLeads: pipelineStore.savedLeads }

    const [calendarSync, emailSync] = await Promise.all([
      syncGoogleCalendarIfStale(freshUser).catch((err) => ({
        synced: false,
        error: err?.message || 'calendar_sync_failed',
      })),
      isCrmInboundEmailEnabled()
        ? Promise.resolve({ synced: 0, pipelineUpdated: false, skipped: 'inbound_sync' })
        : syncUserEmailThreadsIfStale(freshUser, store).catch((err) => ({
            synced: 0,
            error: err?.message || 'email_sync_failed',
          })),
    ])

    if (calendarSync?.synced || emailSync?.pipelineUpdated) {
      ;[{ pipelineStore }, metaStore] = await Promise.all([
        loadPipelineStoreForNotifications(user, { since }),
        readStore({ only: NOTIFICATION_META_COLLECTIONS }),
      ])
      freshUser = metaStore.users.find((u) => u.id === user.id) || user
      store = { ...metaStore, savedLeads: pipelineStore.savedLeads }
    } else if (calendarSync?.synced) {
      const usersStore = await readStore({ only: ['users'] })
      freshUser = usersStore.users.find((u) => u.id === user.id) || freshUser
    }

    let reminderEmails = { morning: 0, imminent: 0 }
    try {
      reminderEmails = await dispatchUserReminderEmails(freshUser, store)
    } catch (err) {
      console.warn('reminder email dispatch failed:', err?.message || err)
    }

    const data = buildCrmNotifications(store, freshUser, { since })
    const hasNewReplies = (data.items || []).some((item) => item.type === 'reply')
    return sendJson(res, 200, {
      ...data,
      sync: {
        calendar: calendarSync,
        email: emailSync,
        reminderEmails,
      },
      pipelineUpdated: Boolean(emailSync?.pipelineUpdated || hasNewReplies),
    })
  } catch (error) {
    return sendJson(res, 200, {
      items: [],
      serverTime: new Date().toISOString(),
      warning: error.message || 'Notifications temporarily unavailable',
    })
  }
}
