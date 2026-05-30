import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyPanelPreferences,
  isDefaultPanelPreferences,
  loadPanelPreferences,
  normalizePanelPreferences,
  resetPanelPreferences,
  updatePanelPreferenceGroup,
} from '../lib/panelPreferences'

export default function usePanelPreferences(userId) {
  const [preferences, setPreferences] = useState(() => loadPanelPreferences(userId))

  useEffect(() => {
    const next = loadPanelPreferences(userId)
    setPreferences(next)
    applyPanelPreferences(next)
  }, [userId])

  useEffect(() => {
    applyPanelPreferences(preferences)
  }, [preferences])

  const isDefault = useMemo(() => isDefaultPanelPreferences(preferences), [preferences])

  const setGroupPreference = useCallback(
    (groupId, patch) => {
      setPreferences((prev) => updatePanelPreferenceGroup(userId, prev, groupId, patch))
    },
    [userId]
  )

  const resetToDefault = useCallback(() => {
    setPreferences(resetPanelPreferences(userId))
  }, [userId])

  return {
    preferences: normalizePanelPreferences(preferences),
    isDefault,
    setGroupPreference,
    resetToDefault,
  }
}
