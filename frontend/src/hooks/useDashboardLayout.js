import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import {
  defaultDashboardLayout,
  readDashboardLayout,
  writeDashboardLayout,
} from '../lib/dashboardLayoutPreferences'

export function useDashboardLayout(userId) {
  const [layout, setLayout] = useState(() => defaultDashboardLayout())
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    if (!userId) {
      setLayout(defaultDashboardLayout())
      setSynced(false)
      return
    }

    const local = readDashboardLayout(userId)
    setLayout(local)

    let cancelled = false
    ;(async () => {
      try {
        const data = await api.getDashboardLayout()
        if (cancelled) return
        if (data?.layout?.length) {
          setLayout(data.layout)
          writeDashboardLayout(userId, data.layout)
        }
      } catch {
        /* offline — keep local cache */
      } finally {
        if (!cancelled) setSynced(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  const saveLayout = useCallback(
    (next) => {
      const normalized =
        typeof next === 'function' ? next(layout) : next
      const resolved = Array.isArray(normalized) ? normalized : layout
      setLayout(resolved)
      if (!userId) return

      writeDashboardLayout(userId, resolved)
      void api.saveDashboardLayout(resolved).catch(() => {})
    },
    [userId, layout]
  )

  const isVisible = useCallback(
    (widgetId) => {
      const row = layout.find((l) => l.id === widgetId)
      return row ? row.visible !== false : true
    },
    [layout]
  )

  const visibleOrder = useMemo(() => layout.filter((l) => l.visible !== false).map((l) => l.id), [layout])

  return {
    layout,
    saveLayout,
    isVisible,
    visibleOrder,
    synced,
    resetLayout: () => saveLayout(defaultDashboardLayout()),
  }
}
