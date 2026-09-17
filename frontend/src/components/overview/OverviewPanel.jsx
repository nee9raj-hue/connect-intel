import { useApp } from '../../context/AppContext'
import HomeDashboard from './HomeDashboard'

export default function OverviewPanel({ onNavigate, isActive = true }) {
  const { pipelineSummary } = useApp()

  if (!isActive) {
    return <div className="panel-shell overview-panel-v3 dash-home-shell hidden" aria-hidden />
  }

  return (
    <div className="panel-shell overview-panel-v3 dash-home-shell">
      <div className="panel-body-scroll">
        <HomeDashboard
          onNavigate={onNavigate}
          isActive={isActive}
          pipelineSummary={pipelineSummary}
        />
      </div>
    </div>
  )
}
