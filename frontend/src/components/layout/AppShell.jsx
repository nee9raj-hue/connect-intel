import { useCallback, useEffect, useState } from 'react'
import { cycleSidebarMode, loadSidebarMode, saveSidebarMode } from '../../lib/sidebarLayout'
import { useApp } from '../../context/AppContext'
import OnboardingModal from '../onboarding/OnboardingModal'
import Sidebar from './Sidebar'
import SidebarToggleButton from './SidebarToggleButton'
import AppHeader from './AppHeader'
import EmailOAuthNotice from './EmailOAuthNotice'
import CrmGmailOAuthNotice from './CrmGmailOAuthNotice'
import MobileRequiredModal from '../profile/MobileRequiredModal'
import PanelViewport from './PanelViewport'
import { useWorkspaceSync } from '../../hooks/useWorkspaceSync'
import SessionReconnectBanner from './SessionReconnectBanner'
import GmailSetupModal, { markGmailSetupDone, useGmailSetupNeeded } from '../onboarding/GmailSetupModal'
import ConnectAssistant from '../assistant/ConnectAssistant'
import MobileNavPill from './MobileNavPill'
import useIsMobile from '../../hooks/useIsMobile'

export default function AppShell() {
  const { user, syncWorkspace, setPanelNavigate, openPipelineLead, pipelineLeadId } = useApp()
  const isMobile = useIsMobile()
  const [activePanel, setActivePanel] = useState('overview')
  const [panelOptions, setPanelOptions] = useState({})
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState(() => loadSidebarMode())

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarMode((prev) => {
      const next = cycleSidebarMode(prev)
      saveSidebarMode(next)
      return next
    })
  }, [])
  const [liveToast, setLiveToast] = useState(null)
  const needsOnboarding = user && !user.onboardingComplete && !user.isPlatformAdmin
  const { needed: needsGmailSetup, setNeeded: setNeedsGmailSetup } = useGmailSetupNeeded(user)
  const showMobileNavPill =
    isMobile && user && !user.isPlatformAdmin && !needsOnboarding && !pipelineLeadId
  useWorkspaceSync({
    enabled: Boolean(user?.onboardingComplete || user?.isPlatformAdmin),
    userId: user?.id,
    syncWorkspace,
    onNewNotifications: (items) => {
      const hit =
        items.find((i) => i.type === 'assignment') ||
        items.find((i) => i.type === 'team_note') ||
        items.find((i) => i.type === 'team_task')
      if (hit) setLiveToast(hit.title)
    },
  })

  useEffect(() => {
    if (!liveToast) return undefined
    const t = setTimeout(() => setLiveToast(null), 5000)
    return () => clearTimeout(t)
  }, [liveToast])

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      setActivePanel('admin-customers')
    }
  }, [user?.isPlatformAdmin, user?.id])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauth = params.get('email_oauth')
    if (!oauth) return
    if (oauth === 'connected' || oauth === 'error') {
      setActivePanel(user?.isPlatformAdmin ? 'integrations' : 'team')
    }
  }, [user?.isPlatformAdmin])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const panel = params.get('panel')
    const lead = params.get('lead')
    if (panel) setActivePanel(panel)
    if (lead && user) openPipelineLead(lead, 'overview')
    if (panel || lead) {
      params.delete('panel')
      params.delete('lead')
      const qs = params.toString()
      const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`
      window.history.replaceState({}, '', next)
    }
  }, [user?.id, openPipelineLead])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crm_gmail') === 'connected') {
      markGmailSetupDone()
    }
  }, [])

  const navigate = useCallback((id, options = {}) => {
    setActivePanel(id)
    setPanelOptions(options || {})
    setMobileNavOpen(false)
  }, [])

  useEffect(() => {
    setPanelNavigate(navigate)
    return () => setPanelNavigate(null)
  }, [navigate, setPanelNavigate])

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f0f4f8]">
      <Sidebar
        active={activePanel}
        panelOptions={panelOptions}
        onNavigate={navigate}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        sidebarMode={sidebarMode}
        onToggleSidebarCollapsed={toggleSidebarCollapsed}
      />
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="md:hidden shrink-0 flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-lg border border-gray-200 text-gray-700"
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="text-sm font-semibold text-gray-900 truncate">Connect Intel</span>
        </div>
        {user?.isPlatformAdmin && (
          <EmailOAuthNotice onOpenSystemStatus={() => navigate('integrations')} />
        )}
        <MobileRequiredModal />
        {!user?.isPlatformAdmin && (
          <AppHeader
            onNavigate={navigate}
            sidebarMode={sidebarMode}
            onToggleSidebarCollapsed={toggleSidebarCollapsed}
          />
        )}
        {user?.isPlatformAdmin && (
          <div className="hidden md:flex shrink-0 items-center px-4 py-2 bg-white border-b border-gray-200">
            <SidebarToggleButton mode={sidebarMode} onToggle={toggleSidebarCollapsed} />
          </div>
        )}
        <CrmGmailOAuthNotice
          onOpenTeam={() =>
            navigate(user?.isOrgAdmin && user?.accountType === 'company' ? 'team' : 'my-email')
          }
        />
        <SessionReconnectBanner />
        {liveToast && (
          <div
            className="shrink-0 mx-3 mt-2 text-xs font-medium text-[#5b4a00] bg-[#fffbeb] border border-[#ffe48a] rounded-lg px-3 py-2"
            role="status"
          >
            {liveToast} — pipeline updated automatically
          </div>
        )}
        <div
          className={`flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden max-md:h-0 ${showMobileNavPill ? 'mobile-main-pad md:pb-0' : ''}`}
        >
          <PanelViewport onNavigate={navigate} activePanel={activePanel} panelOptions={panelOptions} />
        </div>
      </main>
      {showMobileNavPill && (
        <MobileNavPill
          activePanel={activePanel}
          panelOptions={panelOptions}
          onNavigate={navigate}
          onOpenMenu={() => setMobileNavOpen(true)}
        />
      )}
      {needsOnboarding && <OnboardingModal />}
      {needsGmailSetup && !needsOnboarding && (
        <GmailSetupModal onDone={() => setNeedsGmailSetup(false)} />
      )}
      {user && !needsOnboarding && (
        <ConnectAssistant onNavigate={navigate} fabAboveMobilePill={showMobileNavPill} />
      )}
    </div>
  )
}
