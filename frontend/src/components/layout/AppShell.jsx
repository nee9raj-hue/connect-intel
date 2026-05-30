import { useCallback, useEffect, useRef, useState } from 'react'
import { cycleSidebarMode, loadSidebarMode, saveSidebarMode } from '../../lib/sidebarLayout'
import { isChithiPanel } from '../../lib/chithiNav'
import {
  appLocationKey,
  parseAppLocation,
  pushAppLocation,
  stripEphemeralQueryParams,
} from '../../lib/appHistory'
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
import NotificationBell from './NotificationBell'
import useIsMobile from '../../hooks/useIsMobile'
import useMobileNavGenie from '../../hooks/useMobileNavGenie'
import useChithiAlerts from '../../hooks/useChithiAlerts'
import PwaInstallBanner from './PwaInstallBanner'
import ChithiPushBanner from './ChithiPushBanner'
import { MenuIcon } from '../ui/icons'

export default function AppShell() {
  const {
    user,
    syncWorkspace,
    setPanelNavigate,
    openPipelineLead,
    pipelineLeadId,
    setPipelineLeadId,
    chithiUnread,
    refreshChithiUnread,
    setClosePipelineLead,
  } = useApp()
  const isMobile = useIsMobile()
  const [activePanel, setActivePanel] = useState('overview')
  const [panelOptions, setPanelOptions] = useState({})
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState(() => loadSidebarMode())
  const historyReadyRef = useRef(false)
  const applyingHistoryRef = useRef(false)
  const lastHistoryKeyRef = useRef('')
  const lastLeadIdRef = useRef(null)

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

  const applyLocation = useCallback(
    (location) => {
      const { panel, panelOptions: opts = {}, leadId } = location || {}
      setActivePanel(panel || 'overview')
      setPanelOptions(opts)
      setMobileNavOpen(false)
      if (leadId) openPipelineLead(leadId)
      else setPipelineLeadId(null)
    },
    [openPipelineLead, setPipelineLeadId]
  )

  const commitHistory = useCallback((location, { replace = false } = {}) => {
    const key = appLocationKey(location)
    if (!replace && lastHistoryKeyRef.current === key) return
    pushAppLocation(location, { replace })
    lastHistoryKeyRef.current = key
    lastLeadIdRef.current = location?.leadId || null
  }, [])

  useEffect(() => {
    if (!user) return undefined

    applyingHistoryRef.current = true

    const fromUrl = parseAppLocation(window.location.search)
    let initial = fromUrl
    if (user.isPlatformAdmin && !new URLSearchParams(window.location.search).get('panel')) {
      initial = { panel: 'admin-customers', panelOptions: {}, leadId: null }
    }

    applyLocation(initial)
    commitHistory(initial, { replace: true })
    stripEphemeralQueryParams()
    historyReadyRef.current = true

    applyingHistoryRef.current = false

    return undefined
  }, [user?.id, user?.isPlatformAdmin, applyLocation, commitHistory])

  useEffect(() => {
    const onPopState = () => {
      applyingHistoryRef.current = true
      const loc = parseAppLocation(window.location.search)
      applyLocation(loc)
      lastHistoryKeyRef.current = appLocationKey(loc)
      lastLeadIdRef.current = loc.leadId
      applyingHistoryRef.current = false
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [applyLocation])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauth = params.get('email_oauth')
    if (!oauth) return
    if (oauth === 'connected' || oauth === 'error') {
      const panel = user?.isPlatformAdmin ? 'integrations' : 'team'
      applyLocation({ panel, panelOptions: {}, leadId: null })
      commitHistory({ panel, panelOptions: {}, leadId: null }, { replace: true })
      stripEphemeralQueryParams()
    }
  }, [user?.isPlatformAdmin, applyLocation, commitHistory])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crm_gmail') === 'connected') {
      markGmailSetupDone()
    }
  }, [])

  const navigate = useCallback(
    (id, options = {}, navOpts = {}) => {
      const replace = Boolean(navOpts.replace)
      const leavingChithi = isChithiPanel(activePanel) && !isChithiPanel(id)
      if (leavingChithi && sidebarMode === 'rail') {
        setSidebarMode('expanded')
        saveSidebarMode('expanded')
      }

      const loc = { panel: id, panelOptions: options || {}, leadId: null }

      if (pipelineLeadId) setPipelineLeadId(null)
      setActivePanel(id)
      setPanelOptions(options || {})
      setMobileNavOpen(false)

      if (!applyingHistoryRef.current && historyReadyRef.current) {
        commitHistory(loc, { replace })
      }
    },
    [activePanel, sidebarMode, pipelineLeadId, setPipelineLeadId, commitHistory]
  )

  useEffect(() => {
    if (!historyReadyRef.current || applyingHistoryRef.current) return undefined
    if (lastLeadIdRef.current === pipelineLeadId) return undefined

    const hadLead = Boolean(lastLeadIdRef.current)
    const hasLead = Boolean(pipelineLeadId)
    lastLeadIdRef.current = pipelineLeadId

    const loc = { panel: activePanel, panelOptions, leadId: pipelineLeadId }
    if (hasLead && !hadLead) commitHistory(loc)
    else if (!hasLead && hadLead) commitHistory(loc, { replace: true })

    return undefined
  }, [pipelineLeadId, activePanel, panelOptions, commitHistory])

  const closePipelineLead = useCallback(() => {
    const state = window.history.state
    if (state?.ciApp && state?.leadId && window.history.length > 1) {
      window.history.back()
      return
    }
    setPipelineLeadId(null)
    if (historyReadyRef.current) {
      commitHistory({ panel: activePanel, panelOptions, leadId: null }, { replace: true })
    }
  }, [activePanel, panelOptions, setPipelineLeadId, commitHistory])

  useEffect(() => {
    setClosePipelineLead(closePipelineLead)
    return () => setClosePipelineLead(null)
  }, [closePipelineLead, setClosePipelineLead])

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
          className={`ci-mobile-top-bar md:hidden shrink-0 flex items-center gap-1.5 border-b border-[#e5e9ee] bg-white px-2.5 py-2 ${
            chithiFocus ? 'hidden' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="ci-mobile-top-bar__menu rounded-xl border border-[#d7dde5] bg-white p-1.5 text-[#536072] shrink-0"
            aria-label="Open menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <img
            src={BRAND_LOGO_MARK_LIGHT}
            alt="Connect Intel"
            className={`ci-mobile-top-bar__logo h-6 w-auto max-w-[120px] shrink-0 ${BRAND_LOGO_MARK_CLASS}`}
          />
          <div id="ci-mobile-top-bar-slot" className="ci-mobile-top-bar-slot min-w-0 flex-1" />
          <div className="ci-mobile-top-bar__bell shrink-0">
            <NotificationBell />
          </div>
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
      {user && !needsOnboarding && (
        <ConnectAssistant
          onNavigate={navigate}
          fabAboveMobilePill={showMobileNavPill && mobilePillVisible}
        />
      )}
    </div>
  )
}
