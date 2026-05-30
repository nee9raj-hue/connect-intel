import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { storeSessionToken } from '../lib/sessionAuth'
import { defaultCrm } from '../lib/crmConstants'
import { loadReadNotificationIds, saveReadNotificationIds } from '../lib/notificationStorage'
import { getNotificationTarget } from '../lib/notificationNavigation'
import { navTargetToOptions } from '../lib/navConfig'
import { withTimeout } from '../lib/fetchWithTimeout'

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

function mergeLeadInList(prev, lead) {
  if (!lead?.id) return prev
  const index = prev.findIndex((entry) => entry.id === lead.id)
  if (index < 0) return [...prev, lead]
  const next = [...prev]
  next[index] = lead
  return next
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [screen, setScreen] = useState('landing') // landing | auth | app
  const [savedLeads, setSavedLeads] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [orgLeadTags, setOrgLeadTags] = useState([])
  const [ready, setReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [pipelineLeadId, setPipelineLeadId] = useState(null)
  const [pipelineAssigneeFilter, setPipelineAssigneeFilter] = useState(null)
  const [notifications, setNotifications] = useState([])
  const readNotificationIdsRef = useRef(loadReadNotificationIds())
  const [notificationTick, setNotificationTick] = useState(0)
  const [sessionError, setSessionError] = useState(null)
  const panelNavigateRef = useRef(null)
  const pendingLeadOpenRef = useRef({ leadId: null, tab: null })
  const workspaceLoadedAtRef = useRef(0)
  const workspaceLoadInFlightRef = useRef(null)
  const [pipelineSummary, setPipelineSummary] = useState({
    total: 0,
    byStatus: [],
    cities: [],
    states: [],
  })
  const [pipelineLoad, setPipelineLoad] = useState({
    total: 0,
    loaded: 0,
    hasMore: false,
    loadingMore: false,
  })
  const [contactsFocusId, setContactsFocusId] = useState(null)
  const [calendarFocus, setCalendarFocus] = useState(null)
  const [chithiUnread, setChithiUnread] = useState({ messages: 0, tasks: 0, total: 0 })

  const refreshChithiUnread = useCallback(async () => {
    if (user?.accountType !== 'company' || !user?.organizationId) {
      setChithiUnread({ messages: 0, tasks: 0, total: 0 })
      return
    }
    try {
      const data = await api.getChithiSummary()
      setChithiUnread(data.unread || { messages: 0, tasks: 0, total: 0 })
    } catch {
      // ignore polling errors
    }
  }, [user?.accountType, user?.organizationId])

  const markChithiSeen = useCallback(async () => {
    try {
      const data = await api.markChithiSeen()
      if (data.user) {
        setUser((prev) => {
          if (!prev) return data.user
          return {
            ...prev,
            ...data.user,
            isOrgAdmin: data.user.isOrgAdmin ?? prev.isOrgAdmin,
            isPlatformAdmin: data.user.isPlatformAdmin ?? prev.isPlatformAdmin,
            accountType: data.user.accountType ?? prev.accountType,
            orgRole: data.user.orgRole ?? prev.orgRole,
          }
        })
      }
      setChithiUnread(data.unread || { messages: 0, tasks: 0, total: 0 })
    } catch {
      // ignore
    }
  }, [])

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

  useEffect(() => {
    if (user?.accountType === 'company' && user?.organizationId) {
      void refreshChithiUnread()
    } else {
      setChithiUnread({ messages: 0, tasks: 0, total: 0 })
    }
  }, [user?.id, user?.accountType, user?.organizationId, refreshChithiUnread])

  const refreshOrgLeadTags = useCallback(async () => {
    if (user?.accountType !== 'company' || !user?.organizationId) {
      setOrgLeadTags([])
      return []
    }
    try {
      const data = await api.getOrgLeadTags({ silent: true })
      const tags = data.tags || []
      setOrgLeadTags(tags)
      return tags
    } catch {
      return []
    }
  }, [user?.accountType, user?.organizationId])

  const loadedCountRef = useRef(0)
  const pipelineLoadRef = useRef(pipelineLoad)
  useEffect(() => {
    pipelineLoadRef.current = pipelineLoad
  }, [pipelineLoad])

  const loadPipelineList = useCallback(async (filters = {}, { append = false, silent = false } = {}) => {
    const offset = append ? loadedCountRef.current : 0
    const data = await api.fetchPipelineLeads({
      offset,
      limit: 100,
      silent,
      ...filters,
    })
    const leads = data.leads || []
    const newLoaded = append ? offset + leads.length : leads.length
    loadedCountRef.current = newLoaded
    setSavedLeads((prev) => (append ? [...prev, ...leads] : leads))
    setPipelineLoad({
      total: data.total ?? data.pipelineTotal ?? 0,
      loaded: newLoaded,
      hasMore: Boolean(data.hasMore),
      loadingMore: false,
    })
    workspaceLoadedAtRef.current = Date.now()
    return leads
  }, [])

  const loadMorePipelineLeads = useCallback(
    async (filters = {}) => {
      const load = pipelineLoadRef.current
      if (load.loadingMore || !load.hasMore) return
      setPipelineLoad((prev) => ({ ...prev, loadingMore: true }))
      try {
        await loadPipelineList(filters, { append: true, silent: true })
      } catch {
        setPipelineLoad((prev) => ({ ...prev, loadingMore: false }))
      }
    },
    [loadPipelineList]
  )

  const refreshSavedLeads = useCallback(
    async () => {
      try {
        const [summary, page] = await Promise.all([
          api.getPipelineSummary({ silent: false }),
          api.fetchPipelineLeads({ offset: 0, limit: 100, silent: false }),
        ])
        const leads = page.leads || []
        setPipelineSummary({
          total: summary.total ?? 0,
          byStatus: summary.byStatus || [],
          cities: summary.cities || [],
          states: summary.states || [],
        })
        setSavedLeads(leads)
        setSessionError(null)
        setPipelineLoad({
          total: summary.total ?? page.pipelineTotal ?? leads.length,
          loaded: leads.length,
          hasMore: Boolean(page.hasMore),
          loadingMore: false,
        })
        loadedCountRef.current = leads.length
        workspaceLoadedAtRef.current = Date.now()
        return leads
      } catch (error) {
        if (error.status === 401) {
          setSessionError(error.message || 'Session expired. Please sign in again.')
        }
        return null
      }
    },
    []
  )

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
      const isCompany = user?.accountType === 'company' && user?.organizationId
      const [notifResult, tagsResult] = await Promise.allSettled([
        api.getCrmNotifications(since || undefined, { silent: true }),
        isCompany ? api.getOrgLeadTags({ silent: true }) : Promise.resolve({ tags: null }),
      ])

      let leads = null
      let serverTime = new Date().toISOString()
      let newItems = []

      if (notifResult.status === 'fulfilled') {
        serverTime = notifResult.value.serverTime || serverTime
        newItems = mergeNotificationItems(notifResult.value.items || [])
      }

      if (notifResult.status === 'rejected' && notifResult.reason?.status === 401) {
        setSessionError(
          notifResult.reason.message || 'Session expired. Please sign in again.'
        )
        throw notifResult.reason
      }

      if (tagsResult.status === 'fulfilled' && tagsResult.value?.tags) {
        setOrgLeadTags(tagsResult.value.tags)
      }

      return { leads, serverTime, newItems }
    },
    [mergeNotificationItems, user?.accountType, user?.organizationId]
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
        const session = await withTimeout(
          api.getSession(),
          24_000,
          'Sign-in check timed out. You can refresh or continue from the home page.'
        )
        if (cancelled) return

        if (session?.user) {
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
      } catch (error) {
        if (!cancelled) {
          setUser(null)
          setScreen('landing')
          if (error?.message) setSessionError(error.message)
        }
      } finally {
        setReady(true)
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
          setPipelineSummary({ total: 0, byStatus: [], cities: [], states: [] })
        setPipelineLoad({ total: 0, loaded: 0, hasMore: false, loadingMore: false })
        workspaceLoadedAtRef.current = 0
        return
      }

      if (workspaceLoadInFlightRef.current) {
        await workspaceLoadInFlightRef.current
        return
      }

      const run = (async () => {
        try {
          const [summary, page, historyResult] = await Promise.all([
            api.getPipelineSummary({ silent: true }),
            api.fetchPipelineLeads({ offset: 0, limit: 100, silent: true }),
            api.getSearchHistory({ silent: true }),
          ])

          if (cancelled) return

          const leads = page.leads || []
          setPipelineSummary({
            total: summary.total ?? 0,
            byStatus: summary.byStatus || [],
            cities: summary.cities || [],
            states: summary.states || [],
          })
          setSavedLeads(leads)
          setSearchHistory(historyResult.history || [])
          setPipelineLoad({
            total: summary.total ?? page.pipelineTotal ?? leads.length,
            loaded: leads.length,
            hasMore: Boolean(page.hasMore),
            loadingMore: false,
          })
          loadedCountRef.current = leads.length
          workspaceLoadedAtRef.current = Date.now()
          setSessionError(null)

          if (user.organizationId && user.accountType === 'company') {
            const data = await api.getTeamMembers({ silent: true })
            if (!cancelled) setTeamMembers(data.members || [])
          }
        } catch (error) {
          if (!cancelled) {
            if (error?.status === 401) {
              setSessionError(error.message || 'Session expired. Please sign in again.')
            } else if (error?.message) {
              setSessionError(error.message)
            }
          }
        }
      })()

      workspaceLoadInFlightRef.current = run
      try {
        await run
      } finally {
        workspaceLoadInFlightRef.current = null
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
    setAuthBusy(true)
    setSessionError(null)
    try {
      const session = await withTimeout(
        api.createSession(payload),
        45_000,
        'Sign-in is taking too long. Please try again.'
      )
      if (session.token) storeSessionToken(session.token)
      setUser(session.user)
      setScreen('app')
      void acceptPendingInvite()
      return session.user
    } finally {
      setAuthBusy(false)
    }
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
      if (data.leadId) {
        setSavedLeads((current) => current.filter((entry) => entry.id !== data.leadId))
      } else if (data.lead) {
        setSavedLeads((current) => mergeLeadInList(current, data.lead))
      }
    } catch {
      setSavedLeads(previous)
    }
  }, [])

  const addManualLead = useCallback(async (fields) => {
    const data = await api.addManualLead(fields)
    if (data.lead) {
      setSavedLeads((current) => mergeLeadInList(current, data.lead))
    } else {
      await refreshSavedLeads()
    }
    return data
  }, [refreshSavedLeads])

  const patchLead = useCallback(async (leadId, body) => {
    let previous = []
    setSavedLeads((current) => {
      previous = current
      return current
    })

    try {
      const data = await api.updateSavedLead(leadId, body)
      if (data.lead) {
        setSavedLeads((current) => mergeLeadInList(current, data.lead))
      }
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
    if (data.lead) {
      setSavedLeads((current) => mergeLeadInList(current, data.lead))
    }
    return data
  }, [])

  const generateEmailDraft = useCallback(async (leadId, options) => {
    return api.generateCrmEmail(leadId, options)
  }, [])

  const logCrmEmailSend = useCallback(async (leadId, payload) => {
    const data = await api.sendCrmEmail(leadId, payload)
    if (data.lead) {
      setSavedLeads((current) => mergeLeadInList(current, data.lead))
    } else if (data.leads) {
      setSavedLeads(data.leads)
    }
    return data
  }, [])

  const sendBulkEmail = useCallback(async (payload) => {
    const ids = [...new Set(Array.isArray(payload.leadIds) ? payload.leadIds : [])]
    const CHUNK = 10
    const aggregate = {
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      results: [],
      leads: null,
    }
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunkIds = ids.slice(i, i + CHUNK)
      const data = await api.sendBulkCrmEmail(
        { ...payload, leadIds: chunkIds },
        { silent: i > 0, timeoutMs: 120_000 }
      )
      aggregate.sentCount += data.sentCount || 0
      aggregate.failedCount += data.failedCount || 0
      aggregate.skippedCount += data.skippedCount || 0
      aggregate.results.push(...(data.results || []))
      if (data.leads) aggregate.leads = data.leads
    }
    if (aggregate.leads) setSavedLeads(aggregate.leads)
    return aggregate
  }, [])

  const bulkUpdatePipeline = useCallback(async (leadIds, actions) => {
    const data = await api.bulkUpdatePipeline({ leadIds, ...actions })
    if (data.leads) setSavedLeads(data.leads)
    return data
  }, [])

  const syncEmailThread = useCallback(async (leadId) => {
    const data = await api.syncCrmEmailThread(leadId)
    if (data.lead) {
      setSavedLeads((current) => mergeLeadInList(current, data.lead))
    } else if (data.leads) {
      setSavedLeads(data.leads)
    }
    return data
  }, [])

  const logEmailReply = useCallback(async (leadId, payload) => {
    const data = await api.logCrmEmailReply(leadId, payload)
    if (data.lead) {
      setSavedLeads((current) => mergeLeadInList(current, data.lead))
    } else if (data.leads) {
      setSavedLeads(data.leads)
    }
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

  const saveEmailSignature = useCallback(async ({ emailSignature, includeEmailSignature }) => {
    const data = await api.updateUserProfile({ emailSignature, includeEmailSignature })
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

  const openContact = useCallback((contactId) => {
    if (!contactId) return
    setContactsFocusId(contactId)
    panelNavigateRef.current?.('contacts')
  }, [])

  const clearContactsFocus = useCallback(() => {
    setContactsFocusId(null)
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
      panelNavigateRef.current?.(target.panel, navTargetToOptions(target))

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

      if (
        target.panel === 'chithi' ||
        target.panel === 'team-hub' ||
        target.panel === 'team-notes' ||
        target.panel === 'team-tasks'
      ) {
        if (target.leadId) {
          openPipelineLead(target.leadId, 'overview')
          panelNavigateRef.current?.('pipeline')
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
        authBusy,
        screen,
        setScreen,
        login,
        logout,
        refreshSession,
        sessionError,
        setSessionError,
        updateUser,
        savedLeads,
        pipelineSummary,
        pipelineLoad,
        loadPipelineList,
        loadMorePipelineLeads,
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
        saveEmailSignature,
        openPipelineLead,
        consumePendingLeadTab,
        openContact,
        contactsFocusId,
        clearContactsFocus,
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
        orgLeadTags,
        refreshOrgLeadTags,
        refreshTeam,
        chithiUnread,
        refreshChithiUnread,
        markChithiSeen,
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
