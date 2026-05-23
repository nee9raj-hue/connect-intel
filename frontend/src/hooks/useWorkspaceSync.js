import { useEffect, useRef } from 'react'
import { api } from '../lib/api'

const POLL_MS = 45 * 1000
const AUTH_FAIL_PAUSE_MS = 2 * 60 * 1000

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

  useEffect(() => {
    if (!enabled || !userId) return undefined

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    const run = async () => {
      if (Date.now() < pausedUntilRef.current) return

      try {
        await api.touchSession()
        const since = sinceRef.current
        const result = await syncWorkspace(since)
        if (result?.serverTime) {
          sinceRef.current = result.serverTime
        }

        const fresh = (result?.newItems || []).filter((item) => !seenRef.current.has(item.id))
        for (const item of fresh) {
          seenRef.current.add(item.id)
        }

        if (fresh.length) {
          onNewNotifications?.(fresh)
          for (const item of fresh) {
            if (
              item.type === 'assignment' ||
              item.type === 'reply' ||
              item.type === 'meeting' ||
              item.type === 'task' ||
              item.type === 'follow_up'
            ) {
              showBrowserNotification(item)
            }
          }
        }
      } catch (error) {
        if (error?.status === 401) {
          pausedUntilRef.current = Date.now() + AUTH_FAIL_PAUSE_MS
        }
      }
    }

    sinceRef.current = new Date(Date.now() - 30 * 1000).toISOString()
    run()

    const intervalId = setInterval(run, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        pausedUntilRef.current = 0
        run()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [enabled, userId, syncWorkspace, onNewNotifications])
}
