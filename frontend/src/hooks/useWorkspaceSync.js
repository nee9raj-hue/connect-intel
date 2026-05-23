import { useEffect, useRef } from 'react'
import { formatDateTime } from '../lib/crmUiConstants'

const POLL_MS = 20 * 1000

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

  useEffect(() => {
    if (!enabled || !userId) return undefined

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    const run = async () => {
      try {
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
      } catch {
        // ignore transient poll errors
      }
    }

    sinceRef.current = new Date(Date.now() - 30 * 1000).toISOString()
    run()

    const intervalId = setInterval(run, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
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

export { formatDateTime }
