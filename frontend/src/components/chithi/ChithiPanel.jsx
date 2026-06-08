import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import ChithiAppChrome from './ChithiAppChrome'
import ChithiV2Workspace from './ChithiV2Workspace'
import TeamTasksPanel from '../team/TeamTasksPanel'

function resolveView(activePanel, panelOptions) {
  if (panelOptions?.tab === 'tasks' || activePanel === 'team-tasks') return 'tasks'
  if (panelOptions?.tab === 'meetings') return 'meetings'
  return 'chat'
}

export default function ChithiPanel({ onNavigate, activePanel, panelOptions, isActive, onOpenCrmMenu }) {
  const { user, chithiUnread } = useApp()
  const isMobile = useIsMobile()
  const view = resolveView(activePanel, panelOptions)

  if (user?.accountType !== 'company' || !user?.organizationId) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Chithi is available on company accounts with teammates.
      </div>
    )
  }

  if (view === 'tasks') {
    return (
      <div className="chithi-app flex flex-col min-h-0 h-full">
        <ChithiAppChrome
          view="tasks"
          onNavigate={onNavigate}
          chithiUnread={chithiUnread}
          mobileScreen={isMobile ? 'list' : null}
        />
        <div className="chithi-app__body flex-1 min-h-0 overflow-hidden">
          <TeamTasksPanel onNavigate={onNavigate} embedded chithiMode />
        </div>
      </div>
    )
  }

  if (view === 'meetings') {
    return (
      <div className="chithi-app flex flex-col min-h-0 h-full">
        <ChithiAppChrome
          view="meetings"
          onNavigate={onNavigate}
          chithiUnread={chithiUnread}
          mobileScreen={isMobile ? 'list' : null}
        />
        <div className="chithi-app__body flex-1 panel-body-scroll px-4 sm:px-6 py-6 max-w-lg">
          <p className="text-sm text-gray-600">
            Customer meetings and follow-ups live on the CRM calendar. Align with your team before calls.
          </p>
          <button
            type="button"
            className="mt-4 text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg"
            onClick={() => onNavigate?.('crm-calendar', { upcomingOnly: true })}
          >
            Open upcoming meetings
          </button>
        </div>
      </div>
    )
  }

  return (
    <ChithiV2Workspace
      onNavigate={onNavigate}
      panelOptions={panelOptions}
      isActive={isActive}
      onOpenCrmMenu={onOpenCrmMenu}
    />
  )
}
