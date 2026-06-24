import { useApp } from '../../context/AppContext'
import { isFreightDealOrg } from '../../lib/freightDeal'
import HomeDashboard from './HomeDashboard'
import TeamActivityHubPanel from './TeamActivityHubPanel'
import FreightDealsDashboard from './FreightDealsDashboard'

function isMgmtCompanyUser(user) {
  if (user?.accountType !== 'company') return false
  if (user?.isOrgAdmin || user?.orgRole === 'org_admin') return true
  return String(user?.pipelineRole || '').toLowerCase() === 'manager'
}

export default function OverviewPanel({ onNavigate, panelOptions = {}, isActive = true }) {
  const { user, pipelineSummary } = useApp()
  const useUnifiedHub = user?.accountType === 'company' && !isMgmtCompanyUser(user)

  if (!isActive) {
    return <div className="panel-shell overview-panel-v3 dash-home-shell hidden" aria-hidden />
  }

  const freightBlock = isFreightDealOrg(user) ? (
    <FreightDealsDashboard user={user} pipelineSummary={pipelineSummary} onNavigate={onNavigate} />
  ) : null

  return (
    <div className="panel-shell overview-panel-v3 dash-home-shell">
      {useUnifiedHub ? (
        <TeamActivityHubPanel
          onNavigate={onNavigate}
          panelOptions={panelOptions}
          isActive={isActive}
          footer={freightBlock}
        />
      ) : (
        <div className="panel-body-scroll">
          <HomeDashboard onNavigate={onNavigate} isActive={isActive} />
          {freightBlock}
        </div>
      )}
    </div>
  )
}
