import { useApp } from '../../context/AppContext'
import { isFreightDealOrg } from '../../lib/freightDeal'
import HomeDashboard from './HomeDashboard'
import TeamActivityHubPanel from './TeamActivityHubPanel'
import FreightDealsDashboard from './FreightDealsDashboard'

export default function OverviewPanel({ onNavigate, panelOptions = {}, isActive = true }) {
  const { user, pipelineSummary } = useApp()
  const useUnifiedHub = user?.accountType === 'company'

  if (!isActive) return null

  return (
    <div className="panel-shell overview-panel-v3 dash-home-shell">
      {useUnifiedHub ? (
        <TeamActivityHubPanel onNavigate={onNavigate} panelOptions={panelOptions} isActive={isActive} />
      ) : (
        <div className="panel-body-scroll">
          <HomeDashboard onNavigate={onNavigate} isActive={isActive} />
        </div>
      )}
      {isFreightDealOrg(user) ? (
        <div className="panel-body-scroll">
          <FreightDealsDashboard user={user} pipelineSummary={pipelineSummary} onNavigate={onNavigate} />
        </div>
      ) : null}
    </div>
  )
}
