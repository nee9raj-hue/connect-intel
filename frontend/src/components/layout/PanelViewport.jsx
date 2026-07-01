import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import PeopleSearch from '../search/PeopleSearch'
import SavedLeadsPanel from '../saved/SavedLeadsPanel'
import TeamPanel from '../team/TeamPanel'
import OrgBillingPanel from '../team/OrgBillingPanel'
import MyEmailPanel from '../team/MyEmailPanel'
import WhatsAppSettingsPanel from '../team/WhatsAppSettingsPanel'
import IntegrationsPanel from '../integrations/IntegrationsPanel'
import OverviewPanel from '../overview/OverviewPanel'
import PlatformCustomersPanel from '../admin/PlatformCustomersPanel'
import AdminPanel from '../admin/AdminPanel'
import CrmActivityLogPanel from '../crm/CrmActivityLogPanel'
const CrmCalendarPanel = lazy(() => import('../crm/CrmCalendarPanel'))
import MarketingPanel from '../marketing/MarketingPanel'
import ChithiPanel from '../chithi/ChithiPanel'
import TeamNotesPanel from '../team/TeamNotesPanel'
import TeamTasksPanel from '../team/TeamTasksPanel'
import ContactsPanel from '../contacts/ContactsPanel'
import CompaniesPanel from '../companies/CompaniesPanel'
import CrmSequencesPanel from '../crm/CrmSequencesPanel'
import CrmAutomationPanel from '../crm/CrmAutomationPanel'
import ActiveCustomersPanel from '../crm/ActiveCustomersPanel'
import FieldExpensesPanel from '../crm/FieldExpensesPanel'
import PanelCustomizationPanel from '../settings/PanelCustomizationPanel'
import CompanyWorkspacePanel from '../workspace/CompanyWorkspacePanel'
import PlatformAdminHome from '../admin/PlatformAdminHome'
import LoadingExperience from '../ui/LoadingExperience'

const TeamDashboardPanel = lazy(() => import('../crm/TeamDashboardPanel'))
const RepReviewPanel = lazy(() => import('../overview/RepReviewPanel'))
const PipelinePanel = lazy(() => import('../crm/PipelinePanel'))

const PANELS = {
  overview: OverviewPanel,
  search: PeopleSearch,
  saved: SavedLeadsPanel,
  pipeline: PipelinePanel,
  'active-customers': ActiveCustomersPanel,
  'field-expenses': FieldExpensesPanel,
  contacts: ContactsPanel,
  companies: CompaniesPanel,
  chithi: ChithiPanel,
  'team-hub': ChithiPanel,
  'team-notes': ChithiPanel,
  'team-tasks': ChithiPanel,
  'crm-dashboard': TeamDashboardPanel,
  'crm-rep-review': RepReviewPanel,
  'crm-log': CrmActivityLogPanel,
  'crm-calendar': CrmCalendarPanel,
  marketing: MarketingPanel,
  'bulk-email': MarketingPanel,
  'crm-sequences': CrmSequencesPanel,
  'crm-automation': CrmAutomationPanel,
  team: TeamPanel,
  'org-billing': OrgBillingPanel,
  'my-email': MyEmailPanel,
  'whatsapp-settings': WhatsAppSettingsPanel,
  integrations: IntegrationsPanel,
  admin: AdminPanel,
  'admin-home': PlatformAdminHome,
  'admin-customers': PlatformCustomersPanel,
  'app-settings': PanelCustomizationPanel,
  'company-workspace': CompanyWorkspacePanel,
}

/** Panels kept mounted (hidden) for instant back navigation. */
const KEEP_ALIVE_PANELS = new Set(['overview', 'crm-rep-review'])

function resolvePanelId(activePanel) {
  return activePanel === 'bulk-email' ? 'marketing' : activePanel
}

const DEFAULT_PANEL = OverviewPanel

function PanelLoader() {
  return (
    <LoadingExperience
      message="Loading…"
      fill={false}
      className="rounded-2xl border border-[#dde3ea] min-h-[200px] bg-white m-4"
    />
  )
}

function renderPanel(panelId, Panel, props) {
  if (panelId === 'crm-dashboard' || panelId === 'pipeline' || panelId === 'crm-calendar' || panelId === 'crm-rep-review') {
    return (
      <Suspense fallback={<PanelLoader />}>
        <Panel {...props} />
      </Suspense>
    )
  }
  return <Panel {...props} />
}

export default function PanelViewport({ activePanel, panelOptions, onNavigate, onOpenCrmMenu }) {
  const isMobile = useIsMobile()
  const panelId = resolvePanelId(activePanel)
  const [mountedPanels, setMountedPanels] = useState(() => new Set([panelId]))
  const repReviewOptionsRef = useRef({})

  useEffect(() => {
    setMountedPanels((prev) => {
      if (prev.has(panelId)) return prev
      const next = new Set(prev)
      next.add(panelId)
      return next
    })
    if (panelId === 'crm-rep-review') {
      repReviewOptionsRef.current = panelOptions || {}
    }
  }, [panelId, panelOptions])

  if (!isMobile) {
    const aliveIds = [...mountedPanels].filter((id) => KEEP_ALIVE_PANELS.has(id) || id === panelId)

    if (aliveIds.length <= 1) {
      const Panel = PANELS[panelId] || DEFAULT_PANEL
      return (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden">
          {renderPanel(panelId, Panel, {
            onNavigate,
            activePanel,
            panelOptions,
            isActive: true,
            onOpenCrmMenu,
          })}
        </div>
      )
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden">
        {aliveIds.map((id) => {
          const Panel = PANELS[id] || PeopleSearch
          const hidden = id !== panelId
          const options =
            id === 'crm-rep-review' ? repReviewOptionsRef.current : id === panelId ? panelOptions : {}
          return (
            <div
              key={id}
              className={`flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden${hidden ? ' hidden' : ''}`}
            >
              {renderPanel(id, Panel, {
                onNavigate,
                activePanel: hidden ? id : activePanel,
                panelOptions: options,
                isActive: !hidden,
                onOpenCrmMenu,
              })}
            </div>
          )
        })}
      </div>
    )
  }

  const Panel = PANELS[panelId] || DEFAULT_PANEL
  return (
    <div className="relative flex-1 min-h-0 h-full overflow-hidden">
      {renderPanel(panelId, Panel, {
        onNavigate,
        activePanel,
        panelOptions,
        isActive: true,
        onOpenCrmMenu,
      })}
    </div>
  )
}
