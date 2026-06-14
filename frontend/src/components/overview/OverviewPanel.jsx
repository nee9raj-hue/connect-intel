import { useApp } from '../../context/AppContext'
import { isFreightDealOrg } from '../../lib/freightDeal'
import HomeDashboard from './HomeDashboard'
import FreightDealsDashboard from './FreightDealsDashboard'

export default function OverviewPanel({ onNavigate, isActive = true }) {
  const { user, pipelineSummary } = useApp()

  if (!isActive) return null

  return (
    <div className="panel-shell overview-panel-v3 dash-home-shell">
      <div className="panel-body-scroll">
        <HomeDashboard onNavigate={onNavigate} isActive={isActive} />
        {isFreightDealOrg(user) ? (
          <FreightDealsDashboard user={user} pipelineSummary={pipelineSummary} onNavigate={onNavigate} />
        ) : null}
      </div>
    </div>
  )
}
