import { useApp } from '../../context/AppContext'
import { isFreightDealOrg } from '../../lib/freightDeal'
import DashboardCommandCenter from './DashboardCommandCenter'
import FreightDealsDashboard from './FreightDealsDashboard'

export default function OverviewPanel({ onNavigate, isActive = true }) {
  const { user, pipelineSummary } = useApp()

  if (!isActive) return null

  return (
    <div className="panel-shell overview-panel-v3">
      <DashboardCommandCenter onNavigate={onNavigate} isActive={isActive} />
      {isFreightDealOrg(user) ? (
        <div className="ti3-cockpit ti3-cockpit--dash ti3-freight-addon">
          <FreightDealsDashboard user={user} pipelineSummary={pipelineSummary} onNavigate={onNavigate} />
        </div>
      ) : null}
    </div>
  )
}
