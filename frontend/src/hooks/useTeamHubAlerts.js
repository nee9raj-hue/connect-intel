import { useEffect, useRef } from 'react'
import { playTeamHubMessageSound } from '../lib/teamHubSound'

const TEAM_HUB_PANELS = new Set(['team-hub', 'team-notes', 'team-tasks'])

/**
 * Polls team hub unread counts and plays a chime when new messages arrive while CRM is open.
 */
export default function useTeamHubAlerts({
  enabled,
  activePanel,
  teamHubUnread,
  refreshTeamHubUnread,
}) {
  const prevTotalRef = useRef(null)
  const primedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return undefined
    void refreshTeamHubUnread?.()
    const id = window.setInterval(() => {
      void refreshTeamHubUnread?.()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [enabled, refreshTeamHubUnread])

  useEffect(() => {
    if (!enabled) return
    const total = teamHubUnread?.total ?? 0
    if (!primedRef.current) {
      primedRef.current = true
      prevTotalRef.current = total
      return
    }
    const prev = prevTotalRef.current ?? 0
    prevTotalRef.current = total
    if (total <= prev) return
    if (TEAM_HUB_PANELS.has(activePanel)) return
    playTeamHubMessageSound()
  }, [enabled, activePanel, teamHubUnread?.total])
}
