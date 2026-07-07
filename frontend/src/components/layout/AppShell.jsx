import { useCallback, useEffect, useRef, useState } from 'react'
import { cycleSidebarMode, loadSidebarMode, saveSidebarMode } from '../../lib/sidebarLayout'
import { isChithiPanel, normalizeCrmPanel } from '../../lib/chithiNav'
import {
  appLocationKey,
  normalizeLeadId,
  parseAppLocation,
  pushAppLocation,
  resolveInitialAppLocation,
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
import { useWorkspacePulse } from '../../hooks/useWorkspacePulse'
import SessionReconnectBanner from './SessionReconnectBanner'
import GmailSetupModal, { markGmailSetupDone, useGmailSetupNeeded } from '../onboarding/GmailSetupModal'
import { GMAIL_ONBOARDING_PROMPT_ENABLED } from '../../lib/crmProductFlags'
import ConnectAssistant, { ConnectAIButton } from '../assistant/ConnectAssistant'
import ConnectAIFab from '../assistant/ConnectAIFab'
import CommandPalette from '../platform/CommandPalette'
import MobileNavPill from './MobileNavPill'
import EmailSendDock from '../crm/EmailSendDock'
import NotificationBell from './NotificationBell'
import useIsMobile from '../../hooks/useIsMobile'
import useMobileNavGenie from '../../hooks/useMobileNavGenie'
import usePanelPreferences from '../../hooks/usePanelPreferences'
import useAppKeyboardShortcuts from '../../hooks/useAppKeyboardShortcuts'
import PwaInstallBanner from './PwaInstallBanner'
import PwaUpdateBanner from './PwaUpdateBanner'
import { CHITHI_IN_CRM_ENABLED, TEAM_INTELLIGENCE_IN_CRM_ENABLED } from '../../lib/crmProductFlags'
import { MenuIcon, SettingsGearIcon } from '../ui/icons'

export default function AppShell() {
  const {
    user,
    workspaceReady,
    syncWorkspace,
    setPanelNavigate,
    openPipelineLead,
    pipelineLeadId,
    setPipelineLeadId,
    chithiUnread,
    refreshChithiUnread,
    setClosePipelineLead,
    setPipelineAssigneeFilter,
    pipelineAssigneeFilter,
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
  const applyLocationRef = useRef(null)
  const commitHistoryRef = useRef(null)
  const resolvePanelOptionsRef = useRef(null)

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarMode((prev) => {
      const next = cycleSidebarMode(prev)
      saveSidebarMode(next)
      return next
    })
  }, [])
  const [liveToast, setLiveToast] = useState(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const needsOnboarding = user && !user.onboardingComplete && !user.isPlatformAdmin
  const { needed: needsGmailSetup, setNeeded: setNeedsGmailSetup } = useGmailSetupNeeded(user)
  const chithiFocus = isChithiPanel(activePanel)
  const marketingFocus = activePanel === 'marketing' || activePanel === 'bulk-email'
  const calendarImmersive = activePanel === 'crm-calendar'
  const hideMobileFloatingChrome =
    calendarImmersive || chithiFocus || marketingFocus || Boolean(pipelineLeadId)
  const showMobileNavPill =
    isMobile &&
    user &&
    !user.isPlatformAdmin &&
    !needsOnboarding &&
    !hideMobileFloatingChrome
  const mobilePillVisible = useMobileNavGenie(showMobileNavPill)
  usePanelPreferences(user?.id)
  useAppKeyboardShortcuts({
    enabled: Boolean(user && !needsOnboarding),
    activePanel,
    onCommandPalette: () => setCommandOpen(true),
    onOpenAI: () => setAiOpen(true),
  })

  useWorkspaceSync({
    enabled: Boolean(user?.onboardingComplete || user?.isPlatformAdmin),
    workspaceReady,
    userId: user?.id,
    syncWorkspace,
    onNewNotifications: (items) => {
      const hit =
        items.find((i) => i.type === 'assignment') ||
        items.find((i) => i.type === 'reply') ||
        items.find((i) => i.type === 'team_note') ||
        items.find((i) => i.type === 'team_task')
      if (hit) setLiveToast(hit.title)
      if (items.some((i) => i.type === 'team_note' || i.type === 'team_task')) {
        if (CHITHI_IN_CRM_ENABLED) void refreshChithiUnread()
      }
    },
  })

  useWorkspacePulse({
    enabled:
      TEAM_INTELLIGENCE_IN_CRM_ENABLED &&
      Boolean(user?.onboardingComplete || user?.isPlatformAdmin),
    workspaceReady,
    userId: user?.id,
    panel: activePanel,
  })

  useEffect(() => {
    if (!liveToast) return undefined
    const t = setTimeout(() => setLiveToast(null), 5000)
    return () => clearTimeout(t)
  }, [liveToast])

  const resolvePanelOptions = useCallback((panel, options = {}) => options, [])

  const applyLocation = useCallback(
    (location) => {
      const { panel, panelOptions: opts = {}, leadId } = location || {}
      const panelId = normalizeCrmPanel(panel || 'overview')
      const resolved = resolvePanelOptions(panelId, opts)
      setActivePanel(panelId)
      setPanelOptions(resolved)
      setMobileNavOpen(false)
      const assigneeId = resolved.assigneeUserId || resolved.userId
      if (assigneeId) setPipelineAssigneeFilter(assigneeId)
      const normalizedLeadId = normalizeLeadId(leadId)
      if (normalizedLeadId) openPipelineLead(normalizedLeadId)
      else setPipelineLeadId(null)
    },
    [openPipelineLead, setPipelineLeadId, setPipelineAssigneeFilter, resolvePanelOptions]
  )

  const commitHistory = useCallback((location, { replace = false } = {}) => {
    const normalized = {
      ...location,
      leadId: normalizeLeadId(location?.leadId),
    }
    const key = appLocationKey(normalized)
    if (lastHistoryKeyRef.current === key) return
    pushAppLocation(normalized, { replace })
    lastHistoryKeyRef.current = key
    lastLeadIdRef.current = normalized.leadId
  }, [])

  applyLocationRef.current = applyLocation
  commitHistoryRef.current = commitHistory
  resolvePanelOptionsRef.current = resolvePanelOptions

  useEffect(() => {
    if (!user) return undefined

    applyingHistoryRef.current = true

    const initial = resolveInitialAppLocation(window.location.search, {
      isPlatformAdmin: user.isPlatformAdmin,
      pathname: window.location.pathname,
    })
    const panel = initial.panel || 'overview'
    const resolved = {
      panel,
      panelOptions: resolvePanelOptionsRef.current(panel, initial.panelOptions || {}),
      leadId: normalizeLeadId(initial.leadId),
    }

    applyLocationRef.current?.(resolved)
    commitHistoryRef.current?.(resolved, { replace: true })
    stripEphemeralQueryParams()
    historyReadyRef.current = true

    applyingHistoryRef.current = false

    return undefined
  }, [user?.id, user?.isPlatformAdmin])

  useEffect(() => {
    const onPopState = () => {
      applyingHistoryRef.current = true
      const loc = parseAppLocation(window.location.search, window.location.pathname)
      applyLocation(loc)
      lastHistoryKeyRef.current = appLocationKey(loc)
      lastLeadIdRef.current = normalizeLeadId(loc.leadId)
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
      const loc = { panel, panelOptions: {}, leadId: null }
      applyLocationRef.current?.(loc)
      commitHistoryRef.current?.(loc, { replace: true })
      stripEphemeralQueryParams()
    }
  }, [user?.isPlatformAdmin])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crm_gmail') === 'connected') {
      markGmailSetupDone()
    }
  }, [])

  const navigate = useCallback(
    (id, options = {}, navOpts = {}) => {
      const replace = Boolean(navOpts.replace)
      const panelId = normalizeCrmPanel(id)
      const leavingChithi = isChithiPanel(activePanel) && !isChithiPanel(panelId)
      if (leavingChithi && sidebarMode === 'rail') {
        setSidebarMode('expanded')
        saveSidebarMode('expanded')
      }

      const resolvedOptions = resolvePanelOptions(panelId, options || {})
      const assigneeId = resolvedOptions.assigneeUserId || resolvedOptions.userId
      if (assigneeId) setPipelineAssigneeFilter(assigneeId)

      const loc = { panel: panelId, panelOptions: resolvedOptions, leadId: null }

      if (pipelineLeadId) setPipelineLeadId(null)
      setActivePanel(panelId)
      setPanelOptions(resolvedOptions)
      setMobileNavOpen(false)

      if (!applyingHistoryRef.current && historyReadyRef.current) {
        commitHistory(loc, { replace })
      }
    },
    [activePanel, sidebarMode, pipelineLeadId, setPipelineLeadId, setPipelineAssigneeFilter, commitHistory, resolvePanelOptions]
  )

  useEffect(() => {
    if (!historyReadyRef.current || applyingHistoryRef.current) return undefined

    const nextLeadId = normalizeLeadId(pipelineLeadId)
    const prevLeadId = normalizeLeadId(lastLeadIdRef.current)
    if (prevLeadId === nextLeadId) return undefined

    const hadLead = Boolean(prevLeadId)
    const hasLead = Boolean(nextLeadId)

    // History may already include ?lead= while React state is still catching up on first paint.
    if (!hasLead && hadLead) {
      const urlLead = normalizeLeadId(new URLSearchParams(window.location.search).get('lead'))
      if (urlLead && urlLead === prevLeadId) return undefined
    }

    lastLeadIdRef.current = nextLeadId

    const loc = { panel: activePanel, panelOptions, leadId: nextLeadId }
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

  const crmSidebarClass = marketingFocus
    ? 'ci-marketing-focus__crm-sidebar'
    : chithiFocus
      ? 'ci-chithi-focus__crm-sidebar'
      : ''

  return (
    <div
      className={`flex h-[100dvh] w-full overflow-hidden bg-[var(--color-hs-canvas)] ${
        chithiFocus ? 'ci-chithi-focus' : ''
      }${marketingFocus ? ' ci-marketing-focus' : ''}`}
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
        className={crmSidebarClass}
      />
      <main
        className={`ci-app-main flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden${
          marketingFocus ? ' marketing-focus' : ''
        }${calendarImmersive && isMobile ? ' calendar-focus' : ''}`}
      >
        <div
          className={`ci-mobile-top-bar md:hidden shrink-0 flex items-center gap-1.5 border-b border-[#e5e9ee] bg-white px-2.5 py-2 ${
            chithiFocus || marketingFocus || (calendarImmersive && isMobile) ? 'hidden' : ''
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
          {!user?.isPlatformAdmin && (
            <ConnectAIButton compact onClick={() => setAiOpen(true)} />
          )}
          {!user?.isPlatformAdmin && (
            <button
              type="button"
              onClick={() => navigate('app-settings')}
              className={`ci-mobile-top-bar__settings rounded-xl border p-1.5 shrink-0 ${
                activePanel === 'app-settings'
                  ? 'border-[#17191c] bg-[#17191c] text-white'
                  : 'border-[#d7dde5] bg-white text-[#536072]'
              }`}
              aria-label="Display settings"
              title="Display & layout"
            >
              <SettingsGearIcon className="w-5 h-5" />
            </button>
          )}
          <div className="ci-mobile-top-bar__bell shrink-0">
            <NotificationBell />
          </div>
        </div>
        {user?.isPlatformAdmin && (
          <EmailOAuthNotice onOpenSystemStatus={() => navigate('integrations')} />
        )}
        <MobileRequiredModal />
        {!user?.isPlatformAdmin && !chithiFocus && !marketingFocus && !(calendarImmersive && isMobile) && (
          <AppHeader
            onNavigate={navigate}
            onOpenCommandPalette={() => setCommandOpen(true)}
            onOpenAI={() => setAiOpen(true)}
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
        <PwaUpdateBanner />
        {user && !user.isPlatformAdmin && !needsOnboarding && (
          <PwaInstallBanner enabled={!chithiFocus && !marketingFocus} />
        )}
        {liveToast && (
          <div
            className="shrink-0 mx-3 mt-2 rounded-2xl border border-[#d7dde5] bg-white px-3 py-2 text-xs font-medium tracking-[-0.015em] text-[#202938]"
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

      {user && !user.isPlatformAdmin && !needsOnboarding && (
        <EmailSendDock sidebarMode={sidebarMode} onNavigate={navigate} />
      )}
      {needsOnboarding && <OnboardingModal />}
      {GMAIL_ONBOARDING_PROMPT_ENABLED && needsGmailSetup && !needsOnboarding && (
        <GmailSetupModal onDone={() => setNeedsGmailSetup(false)} />
      )}
      {user && !needsOnboarding && !user.isPlatformAdmin && (
        <ConnectAIFab
          open={aiOpen}
          onOpen={() => setAiOpen((v) => !v)}
          isMobile={isMobile}
          mobilePillVisible={showMobileNavPill && mobilePillVisible}
        />
      )}
      {user && !needsOnboarding && (
        <ConnectAssistant
          open={aiOpen}
          onOpenChange={setAiOpen}
          onNavigate={navigate}
          activePanel={activePanel}
          panelOptions={panelOptions}
        />
      )}
      {user && !needsOnboarding && !user.isPlatformAdmin && (
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          onNavigate={navigate}
          openPipelineLead={openPipelineLead}
          user={user}
        />
      )}
    </div>
  )
}
