import { useCallback, useEffect, useState } from 'react'
import { clearTeamIntelReturn, loadTeamIntelReturn } from '../../lib/teamIntelReturn'

export default function TeamIntelReturnBanner({ onNavigate, onCloseLead }) {
  const [returnState, setReturnState] = useState(() => loadTeamIntelReturn())

  useEffect(() => {
    setReturnState(loadTeamIntelReturn())
  }, [])

  const goBack = useCallback(() => {
    const ret = loadTeamIntelReturn()
    onCloseLead?.()
    onNavigate?.('crm-dashboard', {
      period: ret?.period || 'week',
      userId: ret?.memberUserId || undefined,
      timelineFilter: ret?.timelineFilter || 'all',
      teamIntelScrollY: ret?.scrollY || 0,
    })
    clearTeamIntelReturn()
  }, [onNavigate, onCloseLead])

  if (!returnState) return null

  return (
    <div className="team-intel-return-banner" role="status">
      <button type="button" className="team-intel-return-banner__btn" onClick={goBack}>
        ← Back to Team intelligence
      </button>
      <span className="team-intel-return-banner__hint">Your filters and place in the review are saved</span>
    </div>
  )
}
