import { useApp } from '../../context/AppContext'
import { isFreightDealOrg } from '../../lib/freightDeal'
import MyDayDashboard from './MyDayDashboard'
import FreightDealsDashboard from './FreightDealsDashboard'

export default function OverviewPanel({ onNavigate, isActive = true }) {
  const { user, pipelineSummary } = useApp()

  if (!isActive) return null

  return (
    <div className="panel-shell overview-panel-v3 myday-shell">
      <MyDayDashboard onNavigate={onNavigate} isActive={isActive} />
      {isFreightDealOrg(user) ? (
        <div className="myday-freight-addon">
          <FreightDealsDashboard user={user} pipelineSummary={pipelineSummary} onNavigate={onNavigate} />
        </div>
      ) : null}
    </div>
  )
}
