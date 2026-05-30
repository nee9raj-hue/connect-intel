import { useCallback, useEffect, useState } from 'react'
import { cycleSidebarMode, loadSidebarMode, saveSidebarMode } from '../../lib/sidebarLayout'
import { isChithiPanel } from '../../lib/chithiNav'
import { useApp } from '../../context/AppContext'
import OnboardingModal from '../onboarding/OnboardingModal'
import Sidebar from './Sidebar'
import SidebarToggleButton from './SidebarToggleButton'
import { BRAND_LOGO_MARK_LIGHT, BRAND_LOGO_MARK_CLASS } from '../../lib/brandAssets'
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
import DesktopNavPill from './DesktopNavPill'
import useIsMobile from '../../hooks/useIsMobile'
import useMobileNavGenie from '../../hooks/useMobileNavGenie'
import useChithiAlerts from '../../hooks/useChithiAlerts'
import PwaInstallBanner from './PwaInstallBanner'
import ChithiPushBanner from './ChithiPushBanner'
import { MenuIcon } from '../ui/icons'

export default function AppShell() {
  const { user, syncWorkspace, setPanelNavigate, openPipelineLead, pipelineLeadId, chithiUnread, refreshChithiUnread } =
    useApp()
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
  const chithiFocus = isChithiPanel(activePanel)
  const showMobileNavPill =
    isMobile &&
    user &&
    !user.isPlatformAdmin &&
    !needsOnboarding &&
    !pipelineLeadId &&
    !chithiFocus
  const mobilePillVisible = useMobileNavGenie(showMobileNavPill)
  useChithiAlerts({
    enabled: Boolean(user?.accountType === 'company' && user?.organizationId),
    activePanel,
    chithiUnread,
    refreshChithiUnread,
  })

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
      if (items.some((i) => i.type === 'team_note' || i.type === 'team_task')) {
        void refreshChithiUnread()
      }
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
    const tab = params.get('tab')
    if (panel === 'team-notes' || panel === 'team-hub') {
      setActivePanel('chithi')
      setPanelOptions(tab ? { tab } : {})
    } else if (panel === 'team-tasks') {
      setActivePanel('chithi')
      setPanelOptions({ tab: 'tasks' })
    } else if (panel) {
      setActivePanel(panel)
      const channel = params.get('channel')
      const opts = {}
      if (tab) opts.tab = tab
      if (channel) opts.channel = channel
      if (Object.keys(opts).length) setPanelOptions(opts)
    }
    if (lead && user) openPipelineLead(lead, 'overview')
    if (panel || lead) {
      params.delete('panel')
      params.delete('tab')
      params.delete('channel')
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

  const navigate = useCallback(
    (id, options = {}) => {
      const leavingChithi = isChithiPanel(activePanel) && !isChithiPanel(id)
      if (leavingChithi && sidebarMode === 'rail') {
        setSidebarMode('expanded')
        saveSidebarMode('expanded')
      }
      setActivePanel(id)
      setPanelOptions(options || {})
      setMobileNavOpen(false)
    },
    [activePanel, sidebarMode]
  )

  useEffect(() => {
    setPanelNavigate(navigate)
    return () => setPanelNavigate(null)
  }, [navigate, setPanelNavigate])

  return (
    <div
      className={`flex h-[100dvh] w-full overflow-hidden bg-[var(--color-hs-canvas)] ${
        chithiFocus ? 'ci-chithi-focus' : ''
      }`}
    >
      <Sidebar
        active={activePanel}
        panelOptions={panelOptions}
        onNavigate={navigate}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        sidebarMode={sidebarMode}
        onToggleSidebarCollapsed={toggleSidebarCollapsed}
        chithiOpen={chithiFocus}
        className={chithiFocus ? 'ci-chithi-focus__crm-sidebar' : ''}
      />
      <main className="ci-app-main flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div
          className={`md:hidden shrink-0 flex items-center gap-2 border-b border-[#e5e9ee] bg-white px-3 py-2.5 ${
            chithiFocus ? 'hidden' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-xl border border-[#d7dde5] bg-white p-2 text-[#536072]"
            aria-label="Open menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <img
            src={BRAND_LOGO_MARK_LIGHT}
            alt="Connect Intel"
            className={`h-7 w-auto max-w-[200px] ${BRAND_LOGO_MARK_CLASS}`}
          />
        </div>
        {user?.isPlatformAdmin && (
          <EmailOAuthNotice onOpenSystemStatus={() => navigate('integrations')} />
        )}
        <MobileRequiredModal />
        {!user?.isPlatformAdmin && !chithiFocus && (
          <AppHeader
            onNavigate={navigate}
            sidebarMode={sidebarMode}
            onToggleSidebarCollapsed={toggleSidebarCollapsed}
          />
        )}
        {user?.isPlatformAdmin && (
          <div className="hidden md:flex shrink-0 items-center border-b border-[#e5e9ee] bg-white px-4 py-2.5">
            <SidebarToggleButton mode={sidebarMode} onToggle={toggleSidebarCollapsed} />
          </div>
        )}
        <CrmGmailOAuthNotice
          onOpenTeam={() =>
            navigate(user?.isOrgAdmin && user?.accountType === 'company' ? 'team' : 'my-email')
          }
        />
        <SessionReconnectBanner />
        {user && !user.isPlatformAdmin && !needsOnboarding && (
          <PwaInstallBanner enabled={!chithiFocus} />
        )}
        {user && !user.isPlatformAdmin && !needsOnboarding && user?.accountType === 'company' && (
          <ChithiPushBanner enabled={!chithiFocus} />
        )}
        {liveToast && (
          <div
            className="shrink-0 mx-3 mt-2 rounded-2xl border border-[#d7dde5] bg-white px-3 py-2 text-[11px] font-medium tracking-[-0.015em] text-[#202938]"
            role="status"
          >
            {liveToast} · pipeline updated automatically
          </div>
        )}
        <div
          className={`flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden ${
            showMobileNavPill && mobilePillVisible ? 'mobile-main-pad' : ''
          } md:pb-0`}
        >
          <PanelViewport
            onNavigate={navigate}
            activePanel={activePanel}
            panelOptions={panelOptions}
            onOpenCrmMenu={() => setMobileNavOpen(true)}
          />
        </div>
      </main>
      {showMobileNavPill && (
        <MobileNavPill
          activePanel={activePanel}
          panelOptions={panelOptions}
          onNavigate={navigate}
          onOpenMenu={() => setMobileNavOpen(true)}
          visible={mobilePillVisible}
        />
      )}
      <DesktopNavPill
        activePanel={activePanel}
        panelOptions={panelOptions}
        onNavigate={navigate}
      />
      {needsOnboarding && <OnboardingModal />}
      {needsGmailSetup && !needsOnboarding && (
        <GmailSetupModal onDone={() => setNeedsGmailSetup(false)} />
      )}
      {user && !needsOnboarding && <ConnectAssistant />}
    </div>
  )
}
