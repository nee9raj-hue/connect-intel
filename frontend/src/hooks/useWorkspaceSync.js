import { useEffect, useRef } from 'react'

const POLL_MS = 45 * 1000
const INITIAL_DELAY_MS = 5 * 1000
const AUTH_FAIL_PAUSE_MS = 2 * 60 * 1000
const FOCUS_SYNC_MIN_GAP_MS = 90 * 1000

function showBrowserNotification(item) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(item.title, {
      body: item.body,
      tag: item.id,
    })
  } catch {
    // ignore
  }
}

export function useWorkspaceSync({
  enabled,
  userId,
  syncWorkspace,
  onNewNotifications,
}) {
  const sinceRef = useRef(null)
  const seenRef = useRef(new Set())
  const pausedUntilRef = useRef(0)
  const lastSyncAtRef = useRef(0)
  const syncRef = useRef(syncWorkspace)
  const notifyRef = useRef(onNewNotifications)

  syncRef.current = syncWorkspace
  notifyRef.current = onNewNotifications

  useEffect(() => {
    if (!enabled || !userId) return undefined

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    const run = async () => {
      if (Date.now() < pausedUntilRef.current) return

      try {
        const since = sinceRef.current
        const result = await syncRef.current(since)
        if (result?.serverTime) {
          sinceRef.current = result.serverTime
        }

        const fresh = (result?.newItems || []).filter((item) => !seenRef.current.has(item.id))
        for (const item of fresh) {
          seenRef.current.add(item.id)
        }

        if (fresh.length) {
          notifyRef.current?.(fresh)
          for (const item of fresh) {
            if (
              item.type === 'assignment' ||
              item.type === 'reply' ||
              item.type === 'meeting' ||
              item.type === 'task' ||
              item.type === 'follow_up' ||
              item.type === 'team_note' ||
              item.type === 'team_task'
            ) {
              showBrowserNotification(item)
            }
          }
        }
        lastSyncAtRef.current = Date.now()
      } catch (error) {
        if (error?.status === 401) {
          pausedUntilRef.current = Date.now() + AUTH_FAIL_PAUSE_MS
        }
      }
    }

    sinceRef.current = new Date(Date.now() - 30 * 1000).toISOString()
    const initialTimer = setTimeout(run, INITIAL_DELAY_MS)
    const intervalId = setInterval(run, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastSyncAtRef.current < FOCUS_SYNC_MIN_GAP_MS) return
      pausedUntilRef.current = 0
      run()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [enabled, userId])
}
