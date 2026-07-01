import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  defaultDashboardLayout,
  readDashboardLayout,
  writeDashboardLayout,
} from '../lib/dashboardLayoutPreferences'

export function useDashboardLayout(userId) {
  const [layout, setLayout] = useState(() => defaultDashboardLayout())

  useEffect(() => {
    if (!userId) {
      setLayout(defaultDashboardLayout())
      return
    }
    setLayout(readDashboardLayout(userId))
  }, [userId])

  const saveLayout = useCallback(
    (next) => {
      const normalized = typeof next === 'function' ? next(layout) : next
      setLayout(normalized)
      if (userId) writeDashboardLayout(userId, normalized)
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

  return { layout, saveLayout, isVisible, visibleOrder, resetLayout: () => saveLayout(defaultDashboardLayout()) }
}
