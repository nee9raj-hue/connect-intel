import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { storeSessionToken } from '../lib/sessionAuth'
import { defaultCrm } from '../lib/crmConstants'
import { loadReadNotificationIds, saveReadNotificationIds } from '../lib/notificationStorage'
import { getNotificationTarget } from '../lib/notificationNavigation'

const AppContext = createContext(null)

const INVITE_TOKEN_KEY = 'connect_intel_invite_token'

export function getStoredInviteToken() {
  try {
    return sessionStorage.getItem(INVITE_TOKEN_KEY)
  } catch {
    return null
  }
}

export function storeInviteToken(token) {
  try {
    if (token) sessionStorage.setItem(INVITE_TOKEN_KEY, token)
    else sessionStorage.removeItem(INVITE_TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [screen, setScreen] = useState('landing') // landing | auth | app
  const [savedLeads, setSavedLeads] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [ready, setReady] = useState(false)
  const [pipelineLeadId, setPipelineLeadId] = useState(null)
  const [pipelineAssigneeFilter, setPipelineAssigneeFilter] = useState(null)
  const [notifications, setNotifications] = useState([])
  const readNotificationIdsRef = useRef(loadReadNotificationIds())
  const [notificationTick, setNotificationTick] = useState(0)
  const [sessionError, setSessionError] = useState(null)
  const panelNavigateRef = useRef(null)
  const pendingLeadOpenRef = useRef({ leadId: null, tab: null })
  const [calendarFocus, setCalendarFocus] = useState(null)

  const refreshSession = useCallback(async () => {
    try {
      const session = await api.getSession()
      if (session.user) {
        if (session.token) storeSessionToken(session.token)
        setUser(session.user)
        setScreen('app')
        setSessionError(null)
      } else {
        setUser(null)
        setScreen('landing')
      }
      return session.user
    } catch (error) {
      setSessionError(error.message || 'Could not refresh your session')
      return null
    }
  }, [])

  const refreshTeam = useCallback(async () => {
    if (!user?.organizationId || user?.accountType !== 'company') {
      setTeamMembers([])
      return []
    }
    try {
      const data = await api.getTeamMembers()
      setTeamMembers(data.members || [])
      return data.members || []
    } catch {
      setTeamMembers([])
      return []
    }
  }, [user?.organizationId, user?.accountType])

  const refreshSavedLeads = useCallback(async () => {
    try {
      const saved = await api.getSavedLeads()
      setSavedLeads(saved.leads || [])
      setSessionError(null)
      return saved.leads || []
    } catch (error) {
      if (error.status === 401) {
        setSessionError(error.message || 'Session expired. Please sign in again.')
      }
      return null
    }
  }, [])

  const mergeNotificationItems = useCallback((newItems) => {
    if (!newItems?.length) return []
    setNotifications((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]))
      for (const item of newItems) {
        map.set(item.id, { ...item, unread: !readNotificationIdsRef.current.has(item.id) })
      }
      return [...map.values()]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 50)
        .map((n) => ({
          ...n,
          unread: !readNotificationIdsRef.current.has(n.id),
        }))
    })
    return newItems
  }, [])

  const syncWorkspace = useCallback(
    async (since) => {
      const [savedResult, notifResult] = await Promise.allSettled([
        api.getSavedLeads(),
        api.getCrmNotifications(since || undefined),
      ])

      let leads = []
      let serverTime = new Date().toISOString()
      let newItems = []

      if (savedResult.status === 'fulfilled') {
        leads = savedResult.value.leads || []
        setSavedLeads(leads)
        setSessionError(null)
      } else if (savedResult.reason?.status === 401) {
        setSessionError(
          savedResult.reason.message || 'Session expired. Please sign in again.'
        )
        throw savedResult.reason
      }

      if (notifResult.status === 'fulfilled') {
        serverTime = notifResult.value.serverTime || serverTime
        newItems = mergeNotificationItems(notifResult.value.items || [])
      }

      return { leads, serverTime, newItems }
    },
    [mergeNotificationItems]
  )

  const markNotificationRead = useCallback((id) => {
    if (!id) return
    readNotificationIdsRef.current.add(id)
    saveReadNotificationIds(readNotificationIdsRef.current)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    )
    setNotificationTick((t) => t + 1)
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      for (const n of prev) readNotificationIdsRef.current.add(n.id)
      saveReadNotificationIds(readNotificationIdsRef.current)
      return prev.map((n) => ({ ...n, unread: false }))
    })
    setNotificationTick((t) => t + 1)
  }, [])

  const unreadNotificationCount = useMemo(() => {
    void notificationTick
    return notifications.filter((n) => n.unread).length
  }, [notifications, notificationTick])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const session = await api.getSession()
        if (cancelled) return

        if (session.user) {
          if (session.token) storeSessionToken(session.token)
          setUser(session.user)
          setScreen('app')
          const token = getStoredInviteToken()
          if (token) {
            try {
              const data = await api.acceptInvite(token)
              storeInviteToken(null)
              setUser(data.user)
            } catch {
              // invite may be for different email
            }
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null)
          setScreen('landing')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadWorkspace = async () => {
      if (!user) {
        setSavedLeads([])
        setSearchHistory([])
        setTeamMembers([])
        return
      }

      try {
        const [saved, history] = await Promise.all([
          api.getSavedLeads(),
          api.getSearchHistory(),
        ])

        if (cancelled) return
        setSavedLeads(saved.leads || [])
        setSearchHistory(history.history || [])

        if (user.organizationId && user.accountType === 'company') {
          const data = await api.getTeamMembers()
          if (!cancelled) setTeamMembers(data.members || [])
        }
      } catch (error) {
        if (!cancelled && error?.status === 401) {
          setSessionError(error.message || 'Session expired. Please sign in again.')
        }
      }
    }

    loadWorkspace()
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.organizationId, user?.accountType])

  const acceptPendingInvite = useCallback(async () => {
    const token = getStoredInviteToken()
    if (!token) return null
    try {
      const data = await api.acceptInvite(token)
      storeInviteToken(null)
      setUser(data.user)
      return data.user
    } catch {
      return null
    }
  }, [])

  const login = useCallback(async (payload) => {
    const session = await api.createSession(payload)
    if (session.token) storeSessionToken(session.token)
    setSessionError(null)
    setUser(session.user)
    setScreen('app')
    await acceptPendingInvite()
    return session.user
  }, [acceptPendingInvite])

  const logout = useCallback(async () => {
    try {
      await api.destroySession()
    } catch {
      // Keep the client state moving even if the network call fails.
    }
    storeSessionToken(null)
    setUser(null)
    setSessionError(null)
    setSavedLeads([])
    setSearchHistory([])
    setTeamMembers([])
    setPipelineLeadId(null)
    setScreen('landing')
  }, [])

  const completeOnboarding = useCallback(async (payload) => {
    const data = await api.completeOnboarding(payload)
    if (data.token) storeSessionToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const inviteTeamMember = useCallback(
    async (payload) => {
      const data = await api.inviteTeamMember(payload)
      if (data.user) setUser(data.user)
      await refreshTeam()
      return data
    },
    [refreshTeam]
  )

  const updateTeamBranding = useCallback(async (payload) => {
    return api.updateTeamBranding(payload)
  }, [])

  const updateMemberPermissions = useCallback(
    async (payload) => {
      const data = await api.updateMemberPermissions(payload)
      setTeamMembers(data.members || [])
      return data
    },
    []
  )

  const replaceSavedLeads = useCallback((leads) => {
    setSavedLeads(leads || [])
  }, [])

  const toggleSaveLead = useCallback(async (lead) => {
    let previous = []

    setSavedLeads((current) => {
      previous = current
      const exists = current.some((entry) => entry.id === lead.id)
      return exists
        ? current.filter((entry) => entry.id !== lead.id)
        : [...current, { ...lead, savedAt: new Date().toISOString(), crm: defaultCrm() }]
    })

    try {
      const exists = previous.some((entry) => entry.id === lead.id)
      const data = exists ? await api.removeLead(lead.id) : await api.saveLead(lead)
      setSavedLeads(data.leads || [])
    } catch {
      setSavedLeads(previous)
    }
  }, [])

  const addManualLead = useCallback(async (fields) => {
    const data = await api.addManualLead(fields)
    setSavedLeads(data.leads || [])
    return data
  }, [])

  const patchLead = useCallback(async (leadId, body) => {
    let previous = []
    setSavedLeads((current) => {
      previous = current
      return current
    })

    try {
      const data = await api.updateSavedLead(leadId, body)
      setSavedLeads(data.leads || [])
      return data.lead
    } catch (error) {
      setSavedLeads(previous)
      throw error
    }
  }, [])

  const updateSavedLeadCrm = useCallback(
    async (leadId, crmPatch) => patchLead(leadId, { crm: crmPatch }),
    [patchLead]
  )

  const assignLead = useCallback(async (leadId, assignToUserId) => {
    const data = await api.assignLead(leadId, assignToUserId)
    setSavedLeads(data.leads || [])
    return data
  }, [])

  const generateEmailDraft = useCallback(async (leadId, options) => {
    return api.generateCrmEmail(leadId, options)
  }, [])

  const logCrmEmailSend = useCallback(async (leadId, payload) => {
    const data = await api.sendCrmEmail(leadId, payload)
    if (data.leads) setSavedLeads(data.leads)
    return data
  }, [])

  const sendBulkEmail = useCallback(async (payload) => {
    const data = await api.sendBulkCrmEmail(payload)
    if (data.leads) setSavedLeads(data.leads)
    return data
  }, [])

  const bulkUpdatePipeline = useCallback(async (leadIds, actions) => {
    const data = await api.bulkUpdatePipeline({ leadIds, ...actions })
    if (data.leads) setSavedLeads(data.leads)
    return data
  }, [])

  const syncEmailThread = useCallback(async (leadId) => {
    const data = await api.syncCrmEmailThread(leadId)
    if (data.leads) setSavedLeads(data.leads)
    return data
  }, [])

  const logEmailReply = useCallback(async (leadId, payload) => {
    const data = await api.logCrmEmailReply(leadId, payload)
    if (data.leads) setSavedLeads(data.leads)
    return data
  }, [])

  const generateWhatsAppDraft = useCallback(async (leadId, options) => {
    return api.generateCrmWhatsApp(leadId, options)
  }, [])

  const updateMobile = useCallback(async (mobile) => {
    const data = await api.updateUserProfile({ mobile })
    if (data.token) storeSessionToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const setPanelNavigate = useCallback((fn) => {
    panelNavigateRef.current = fn
  }, [])

  const openPipelineLead = useCallback((leadId, tab = null) => {
    if (tab) pendingLeadOpenRef.current = { leadId, tab }
    setPipelineLeadId(leadId)
  }, [])

  const consumePendingLeadTab = useCallback((leadId) => {
    const pending = pendingLeadOpenRef.current
    if (pending.leadId === leadId && pending.tab) {
      pendingLeadOpenRef.current = { leadId: null, tab: null }
      return pending.tab
    }
    return null
  }, [])

  const clearCalendarFocus = useCallback(() => {
    setCalendarFocus(null)
  }, [])

  const navigateToNotification = useCallback(
    (item) => {
      if (!item) return
      markNotificationRead(item.id)

      if (item.meetingId && item.leadId) {
        api.ackMeetingReminder(item.leadId, item.meetingId).catch(() => {})
      }

      const target = getNotificationTarget(item)
      panelNavigateRef.current?.(target.panel)

      if (target.panel === 'crm-calendar') {
        setCalendarFocus({
          eventId: target.calendarEventId,
          leadId: target.leadId,
          scheduledAt: target.scheduledAt,
        })
        if (target.leadId) {
          openPipelineLead(target.leadId, target.leadTab)
        }
        return
      }

      if (target.leadId) {
        openPipelineLead(target.leadId, target.leadTab)
      }
    },
    [markNotificationRead, openPipelineLead]
  )

  const markNotificationsPanelOpened = useCallback(() => {
    markAllNotificationsRead()
  }, [markAllNotificationsRead])

  const isSaved = useCallback(
    (id) => savedLeads.some((l) => l.id === id),
    [savedLeads]
  )

  const addSearchHistory = useCallback(async (entry) => {
    setSearchHistory((prev) => [entry, ...prev].slice(0, 20))

    try {
      const data = await api.addSearchHistory(entry)
      setSearchHistory(data.history || [])
    } catch {
      // Keep the optimistic history entry if the write fails.
    }
  }, [])

  const updateUser = useCallback((updater) => {
    setUser((prev) => {
      if (!prev) return prev
      return typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
    })
  }, [])

  return (
    <AppContext.Provider
      value={{
        user,
        ready,
        screen,
        setScreen,
        login,
        logout,
        refreshSession,
        sessionError,
        setSessionError,
        updateUser,
        savedLeads,
        toggleSaveLead,
        updateSavedLeadCrm,
        addManualLead,
        patchLead,
        assignLead,
        generateEmailDraft,
        logCrmEmailSend,
        sendBulkEmail,
        bulkUpdatePipeline,
        syncEmailThread,
        logEmailReply,
        generateWhatsAppDraft,
        updateMobile,
        openPipelineLead,
        consumePendingLeadTab,
        pipelineLeadId,
        setPipelineLeadId,
        setPanelNavigate,
        navigateToNotification,
        markNotificationsPanelOpened,
        calendarFocus,
        clearCalendarFocus,
        pipelineAssigneeFilter,
        setPipelineAssigneeFilter,
        isSaved,
        searchHistory,
        addSearchHistory,
        completeOnboarding,
        teamMembers,
        refreshTeam,
        refreshSavedLeads,
        syncWorkspace,
        notifications,
        unreadNotificationCount,
        markNotificationRead,
        markAllNotificationsRead,
        mergeNotificationItems,
        inviteTeamMember,
        updateTeamBranding,
        updateMemberPermissions,
        acceptPendingInvite,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
