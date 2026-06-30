import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { storeSessionToken, getSessionToken } from '../lib/sessionAuth'
import { defaultCrm } from '../lib/crmConstants'
import { loadReadNotificationIds, saveReadNotificationIds } from '../lib/notificationStorage'
import { getNotificationTarget } from '../lib/notificationNavigation'
import { navTargetToOptions, normalizePipelineSummary } from '../lib/navConfig'
import { withTimeout } from '../lib/fetchWithTimeout'
import { clearAppNavigationState, preparePostLoginNavigation } from '../lib/appHistory'

const AppContext = createContext(null)

const INVITE_TOKEN_KEY = 'connect_intel_invite_token'
const PIPELINE_ASSIGNEE_KEY = 'ci-pipeline-assignee'

function loadPipelineAssigneeFilter() {
  try {
    const v = sessionStorage.getItem(PIPELINE_ASSIGNEE_KEY)
    return v || null
  } catch {
    return null
  }
}

function persistPipelineAssigneeFilter(userId) {
  try {
    if (userId) sessionStorage.setItem(PIPELINE_ASSIGNEE_KEY, String(userId))
    else sessionStorage.removeItem(PIPELINE_ASSIGNEE_KEY)
  } catch {
    // ignore
  }
}

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

function mergeLightLeadPatch(prev, incoming) {
  if (!incoming?.listLight) return incoming
  const prevCrm = prev.crm || {}
  const incCrm = incoming.crm || {}
  return {
    ...prev,
    ...incoming,
    commercialEmailOptIn:
      incoming.commercialEmailOptIn ??
      (incoming.commercialEmailConsentAt ? true : prev.commercialEmailOptIn),
    commercialEmailConsentAt:
      incoming.commercialEmailConsentAt ?? prev.commercialEmailConsentAt ?? null,
    commercialEmailConsentSource:
      incoming.commercialEmailConsentSource ?? prev.commercialEmailConsentSource ?? null,
    crm: {
      ...prevCrm,
      ...incCrm,
      tasks: incCrm.tasks?.length ? incCrm.tasks : prevCrm.tasks,
      meetings: incCrm.meetings?.length ? incCrm.meetings : prevCrm.meetings,
      deals: Array.isArray(incCrm.deals) ? incCrm.deals : prevCrm.deals,
      activities: incCrm.activities?.length ? incCrm.activities : prevCrm.activities,
      emails: prevCrm.emails,
    },
  }
}

function mergeLeadInList(prev, lead) {
  if (!lead?.id) return prev
  const index = prev.findIndex((entry) => entry.id === lead.id)
  if (index < 0) return [...prev, lead]
  const next = [...prev]
  const existing = prev[index]
  next[index] = existing?.listLight || lead.listLight ? mergeLightLeadPatch(existing, lead) : lead
  return next
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [screen, setScreen] = useState(() => (getSessionToken() ? 'app' : 'landing')) // landing | auth | app
  const [savedLeads, setSavedLeads] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [repRoster, setRepRoster] = useState([])
  const [orgLeadTags, setOrgLeadTags] = useState([])
  const [ready, setReady] = useState(() => Boolean(getSessionToken()))
  const [authBusy, setAuthBusy] = useState(false)
  const [pipelineLeadId, setPipelineLeadId] = useState(null)
  const [pipelineLeadDetailAt, setPipelineLeadDetailAt] = useState(0)
  const [pipelineAssigneeFilter, setPipelineAssigneeFilterState] = useState(loadPipelineAssigneeFilter)
  const setPipelineAssigneeFilter = useCallback((userId) => {
    const next = userId ? String(userId) : null
    setPipelineAssigneeFilterState(next)
    persistPipelineAssigneeFilter(next)
  }, [])
  const [notifications, setNotifications] = useState([])
  const readNotificationIdsRef = useRef(loadReadNotificationIds())
  const [notificationTick, setNotificationTick] = useState(0)
  const [sessionError, setSessionError] = useState(null)
  const panelNavigateRef = useRef(null)
  const closePipelineLeadRef = useRef(null)
  const pendingLeadOpenRef = useRef({ leadId: null, tab: null })
  const workspaceLoadedAtRef = useRef(0)
  const workspaceLoadInFlightRef = useRef(null)
  const teamFetchAtRef = useRef(0)
  const teamFetchInFlightRef = useRef(null)
  const teamMembersRef = useRef(teamMembers)
  teamMembersRef.current = teamMembers
  const [pipelineSummary, setPipelineSummary] = useState(() =>
    normalizePipelineSummary({ total: 0, byStatus: [], cities: [], states: [] })
  )
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

  const refreshTeam = useCallback(async ({ force = false, silent = true } = {}) => {
    if (!user?.organizationId || user?.accountType !== 'company') {
      setTeamMembers([])
      setRepRoster([])
      return []
    }
    const now = Date.now()
    if (!force && teamMembersRef.current.length && now - (teamFetchAtRef.current || 0) < 60_000) {
      return teamMembersRef.current
    }
    if (teamFetchInFlightRef.current) {
      return teamFetchInFlightRef.current
    }
    teamFetchInFlightRef.current = (async () => {
      try {
        const data = await api.getTeamMembers({ silent })
        const members = data.members || []
        setTeamMembers(members)
        setRepRoster(data.repRoster || members)
        teamFetchAtRef.current = Date.now()
        return members
      } catch {
        setTeamMembers([])
        setRepRoster([])
        return []
      } finally {
        teamFetchInFlightRef.current = null
      }
    })()
    return teamFetchInFlightRef.current
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
  const pipelineCursorRef = useRef(null)
  const pipelineLoadRef = useRef(pipelineLoad)
  const pipelineListFetchGenRef = useRef(0)
  useEffect(() => {
    pipelineLoadRef.current = pipelineLoad
  }, [pipelineLoad])

  const loadPipelineList = useCallback(async (filters = {}, { append = false, silent = false } = {}) => {
    let fetchGen = pipelineListFetchGenRef.current
    if (!append) fetchGen = ++pipelineListFetchGenRef.current

    const offset = append ? loadedCountRef.current : 0
    const cursor = append ? pipelineCursorRef.current : null
    const data = await api.fetchPipelineLeads({
      offset,
      cursor,
      limit: 100,
      silent,
      ...filters,
    })
    const leads = data.leads || []
    if (!append && fetchGen !== pipelineListFetchGenRef.current) return leads

    const newLoaded = append ? loadedCountRef.current + leads.length : leads.length
    loadedCountRef.current = newLoaded
    pipelineCursorRef.current = data.nextCursor || null
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
        const assigneeUserId =
          pipelineAssigneeFilter || loadPipelineAssigneeFilter() || undefined
        const bootstrap = await api.getPipelineBootstrap({
          offset: 0,
          limit: 100,
          silent: false,
          assigneeUserId,
        })
        const leads = bootstrap.leads || []
        const summary = bootstrap.summary || {}
        setPipelineSummary(normalizePipelineSummary(summary))
        setSavedLeads(leads)
        setSessionError(null)
        setPipelineLoad({
          total:
            bootstrap.total ??
            bootstrap.pipelineTotal ??
            (assigneeUserId ? leads.length : summary.total) ??
            leads.length,
          loaded: leads.length,
          hasMore: Boolean(bootstrap.hasMore),
          loadingMore: false,
        })
        loadedCountRef.current = leads.length
        pipelineCursorRef.current = bootstrap.nextCursor || null
        workspaceLoadedAtRef.current = Date.now()
        return leads
      } catch (error) {
        if (error.status === 401) {
          setSessionError(error.message || 'Session expired. Please sign in again.')
        }
        return null
      }
    },
    [pipelineAssigneeFilter]
  )

  const refreshPipelineSummary = useCallback(async (filters = {}) => {
    try {
      const data = await api.getPipelineBootstrap({
        summaryOnly: true,
        silent: true,
        status: 'all',
        assigneeUserId: filters.assigneeUserId || undefined,
        tagIds: filters.tagIds,
        q: filters.q || undefined,
        cities: filters.cities,
        states: filters.states,
      })
      if (data?.summary) {
        setPipelineSummary(normalizePipelineSummary(data.summary))
      }
    } catch {
      // keep last summary
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

  const refreshPipelineLead = useCallback(async (leadId, { silent = true } = {}) => {
    if (!leadId) return null
    try {
      const data = await api.getPipelineLead(leadId, { silent })
      if (data?.lead) {
        setSavedLeads((prev) => mergeLeadInList(prev, data.lead))
        if (String(pipelineLeadId) === String(leadId)) {
          setPipelineLeadDetailAt(Date.now())
        }
        return data.lead
      }
    } catch {
      // ignore
    }
    return null
  }, [pipelineLeadId])

  const syncWorkspace = useCallback(
    async (since) => {
      const isCompany = user?.accountType === 'company' && user?.organizationId
      const [notifResult, tagsResult] = await Promise.allSettled([
        api.getCrmNotifications(since || undefined, { silent: true }),
        isCompany ? api.getOrgLeadTags({ silent: true }) : Promise.resolve({ tags: null }),
      ])

      let serverTime = new Date().toISOString()
      let newItems = []
      let pipelineUpdated = false

      if (notifResult.status === 'fulfilled') {
        serverTime = notifResult.value.serverTime || serverTime
        newItems = mergeNotificationItems(notifResult.value.items || [])
        pipelineUpdated = Boolean(notifResult.value.pipelineUpdated)
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

      const replyLeadIds = [
        ...new Set(
          newItems.filter((n) => n.type === 'reply' && n.leadId).map((n) => n.leadId)
        ),
      ]
      for (const leadId of replyLeadIds) {
        void refreshPipelineLead(leadId, { silent: true })
      }

      const shouldRefreshPipeline =
        pipelineUpdated ||
        newItems.some((n) =>
          ['assignment', 'reply', 'meeting', 'task', 'follow_up', 'team_task'].includes(n.type)
        )
      if (shouldRefreshPipeline) {
        void refreshSavedLeads().catch(() => {})
      }

      return { serverTime, newItems, pipelineUpdated }
    },
    [
      mergeNotificationItems,
      refreshPipelineLead,
      refreshSavedLeads,
      user?.accountType,
      user?.organizationId,
    ]
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
          45_000,
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
        setRepRoster([])
        setPipelineSummary(normalizePipelineSummary({ total: 0, byStatus: [], cities: [], states: [] }))
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
          const bootstrapGen = pipelineListFetchGenRef.current
          const assigneeUserId = loadPipelineAssigneeFilter() || undefined
          const [bootstrap, historyResult] = await Promise.all([
            api.getPipelineBootstrap({ offset: 0, limit: 100, silent: true, assigneeUserId }),
            api.getSearchHistory({ silent: true }),
          ])

          if (cancelled) return

          const leads = bootstrap.leads || []
          const summary = bootstrap.summary || {}
          setPipelineSummary(normalizePipelineSummary(summary))
          setSearchHistory(historyResult.history || [])

          const listSuperseded = bootstrapGen !== pipelineListFetchGenRef.current
          if (!listSuperseded) {
            setSavedLeads(leads)
            setPipelineLoad({
              total: bootstrap.total ?? summary.total ?? bootstrap.pipelineTotal ?? leads.length,
              loaded: leads.length,
              hasMore: Boolean(bootstrap.hasMore),
              loadingMore: false,
            })
            loadedCountRef.current = leads.length
            pipelineCursorRef.current = bootstrap.nextCursor || null
            workspaceLoadedAtRef.current = Date.now()
          }
          setSessionError(null)

          if (user.organizationId && user.accountType === 'company') {
            const data = await api.getTeamMembers({ silent: true })
            if (!cancelled) {
              setTeamMembers(data.members || [])
              setRepRoster(data.repRoster || data.members || [])
            }
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

  /** Sidebar counts only — no lead list reload (60s). */
  useEffect(() => {
    if (!user?.id) return
    const refreshCounts = () => {
      api
        .getPipelineBootstrap({ summaryOnly: true, silent: true })
        .then((data) => {
          if (data?.summary) {
            setPipelineSummary(normalizePipelineSummary(data.summary))
          }
        })
        .catch(() => {})
    }
    const timer = setInterval(refreshCounts, 60_000)
    return () => clearInterval(timer)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !pipelineAssigneeFilter) return
    if (pipelineAssigneeFilter === '__unassigned__') return
    const isOrgAdmin = Boolean(
      (user.isOrgAdmin || user.orgRole === 'org_admin') && user.accountType === 'company'
    )
    if (isOrgAdmin) return
    const allowed = new Set([String(user.id), ...teamMembers.map((m) => String(m.userId))])
    if (!allowed.has(String(pipelineAssigneeFilter))) {
      setPipelineAssigneeFilter(null)
    }
  }, [user?.id, user?.isOrgAdmin, user?.orgRole, user?.accountType, teamMembers, pipelineAssigneeFilter, setPipelineAssigneeFilter])

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
      preparePostLoginNavigation()
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
    clearAppNavigationState()
    setUser(null)
    setSessionError(null)
    setSavedLeads([])
    setSearchHistory([])
    setTeamMembers([])
    setRepRoster([])
    setPipelineLeadId(null)
    setScreen('landing')
  }, [])

  const completeOnboarding = useCallback(async (payload) => {
    const data = await api.completeOnboarding(payload)
    if (data.token) storeSessionToken(data.token)
    setUser(data.user)
    preparePostLoginNavigation()
    panelNavigateRef.current?.('overview', {}, { replace: true })
    return data.user
  }, [])

  const inviteTeamMember = useCallback(
    async (payload) => {
      const data = await api.inviteTeamMember(payload)
      if (data.user) setUser(data.user)
      await refreshTeam({ force: true })
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
      setRepRoster(data.repRoster || data.members || [])
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
      if (body?.crm && typeof body.crm === 'object') {
        return current.map((lead) =>
          lead.id === leadId ? { ...lead, crm: { ...(lead.crm || {}), ...body.crm } } : lead
        )
      }
      if (body?.emailConsent !== undefined) {
        const granted = Boolean(body.emailConsent)
        const at = granted ? new Date().toISOString() : null
        return current.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                commercialEmailOptIn: granted,
                commercialEmailConsentAt: at,
                commercialEmailConsentSource: granted ? 'manual' : null,
              }
            : lead
        )
      }
      return current
    })

    const CRM_PATCH_WITHOUT_RELOAD = new Set([
      'status',
      'responseReceived',
      'notes',
      'nextFollowUpAt',
    ])
    const needsFullReload = Boolean(
      body?.contact ||
        (body?.crm &&
          Object.keys(body.crm).some((k) => !CRM_PATCH_WITHOUT_RELOAD.has(k)))
    )

    try {
      const data = await api.updateSavedLead(leadId, body)
      let lead = data.lead
      if (lead && needsFullReload) {
        try {
          const full = await api.getPipelineLead(leadId, { silent: true })
          if (full?.lead) lead = full.lead
        } catch {
          // keep PATCH payload if full fetch fails
        }
      }
      if (lead) {
        setSavedLeads((current) => mergeLeadInList(current, lead))
      }
      if (body?.emailConsent !== undefined && String(pipelineLeadId) === String(leadId)) {
        setPipelineLeadDetailAt(Date.now())
      }
      if (body?.deal) {
        void api
          .getPipelineSummary({ silent: true })
          .then((summary) => setPipelineSummary(normalizePipelineSummary(summary)))
          .catch(() => {})
      }
      return lead
    } catch (error) {
      setSavedLeads(previous)
      throw error
    }
  }, [pipelineLeadId])

  const updateSavedLeadCrm = useCallback(
    async (leadId, crmPatch) => patchLead(leadId, { crm: crmPatch }),
    [patchLead]
  )

  const assignLead = useCallback(async (leadId, assignToUserId) => {
    let previous = []
    setSavedLeads((current) => {
      previous = current
      return current.map((lead) =>
        lead.id === leadId
          ? { ...lead, assignedToUserId: assignToUserId || null }
          : lead
      )
    })
    try {
      const data = await api.assignLead(leadId, assignToUserId)
      if (data.lead) {
        setSavedLeads((current) => mergeLeadInList(current, data.lead))
      }
      return data
    } catch (error) {
      setSavedLeads(previous)
      throw error
    }
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

  const sendBulkEmail = useCallback(async (payload, { onProgress } = {}) => {
    const ids = [...new Set(Array.isArray(payload.leadIds) ? payload.leadIds : [])]
    const aggregate = {
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      campaignId: payload.campaignId || null,
      pendingSends: 0,
    }

    onProgress?.({
      phase: 'queuing',
      total: ids.length,
      sentSoFar: 0,
      failedSoFar: 0,
    })

    try {
      const queued = await api.queueBulkCrmEmail({
        ...payload,
        leadIds: ids,
        resolvedRecipients: Array.isArray(payload.resolvedRecipients)
          ? payload.resolvedRecipients
          : undefined,
      })

      aggregate.skippedCount = queued.skipped?.length || 0
      aggregate.campaignId = queued.campaignId || aggregate.campaignId

      if (!queued.queued && !queued.campaignId) {
        return { ...aggregate, results: [] }
      }

      const sentCount = queued.sent ?? 0
      const failedCount = queued.failed ?? 0
      const pendingSends = queued.pendingSends ?? Math.max(0, ids.length - sentCount - failedCount)

      onProgress?.({
        phase: pendingSends > 0 ? 'background' : 'done',
        total: ids.length,
        sentSoFar: sentCount,
        failedSoFar: failedCount,
        sendStatus: queued.sendStatus || 'queued',
        pending: pendingSends,
        remaining: pendingSends,
        queued: pendingSends,
      })

      return {
        ...aggregate,
        sentCount,
        failedCount,
        campaignId: queued.campaignId || aggregate.campaignId,
        mode: queued.mode || (pendingSends > 0 ? 'queued' : 'inline'),
        background: queued.mode === 'queued' || pendingSends > 0 || Boolean(queued.background),
        sendStatus: queued.sendStatus || 'queued',
        pendingSends,
        done: queued.done ?? pendingSends <= 0,
        firstError: queued.firstError || null,
        workerHint: queued.workerHint || null,
      }
    } catch (error) {
      error.bulkEmailProgress = {
        campaignId: aggregate.campaignId,
        sentCount: aggregate.sentCount,
        failedCount: aggregate.failedCount,
        skippedCount: aggregate.skippedCount,
      }
      if (/timed out/i.test(error?.message || '')) {
        return {
          ...aggregate,
          background: true,
          sendStatus: aggregate.campaignId ? 'queued' : 'preparing',
          pendingSends: ids.length,
          timedOut: true,
          workerHint:
            'The request timed out, but your send may still be processing. Check the Pipeline progress banner or try Send again in a minute.',
        }
      }
      throw error
    }
  }, [])

  const bulkUpdatePipeline = useCallback(async (leadIds, actions) => {
    const data = await api.bulkUpdatePipeline({ leadIds, ...actions })
    if (data.leads?.length) {
      const byId = new Map(data.leads.map((lead) => [lead.id, lead]))
      setSavedLeads((current) =>
        current.map((lead) => (byId.has(lead.id) ? { ...lead, ...byId.get(lead.id) } : lead))
      )
    }
    return data
  }, [])

  const bulkDeletePipeline = useCallback(async (leadIds) => {
    const data = await api.bulkDeletePipeline({ leadIds })
    const removed = new Set((data.deletedIds || []).map(String))
    if (removed.size) {
      setSavedLeads((current) => current.filter((lead) => !removed.has(String(lead.id))))
    }
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

  const setClosePipelineLead = useCallback((fn) => {
    closePipelineLeadRef.current = fn
  }, [])

  const closePipelineLead = useCallback(() => {
    if (closePipelineLeadRef.current) closePipelineLeadRef.current()
    else setPipelineLeadId(null)
  }, [])

  const openPipelineLead = useCallback((leadId, tab = null) => {
    if (tab) pendingLeadOpenRef.current = { leadId, tab }
    setPipelineLeadId(leadId)
    if (leadId) {
      void api.postWorkspacePulse({ leadId, panel: 'pipeline' }, { silent: true })
    }
  }, [])

  const consumePendingLeadTab = useCallback((leadId) => {
    const pending = pendingLeadOpenRef.current
    if (pending.leadId != null && String(pending.leadId) === String(leadId) && pending.tab) {
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
        refreshPipelineSummary,
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
        bulkDeletePipeline,
        syncEmailThread,
        logEmailReply,
        generateWhatsAppDraft,
        updateMobile,
        saveEmailSignature,
        openPipelineLead,
        closePipelineLead,
        consumePendingLeadTab,
        openContact,
        contactsFocusId,
        clearContactsFocus,
        pipelineLeadId,
        pipelineLeadDetailAt,
        refreshPipelineLead,
        setPipelineLeadId,
        setPanelNavigate,
        setClosePipelineLead,
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
        repRoster,
        orgLeadTags,
        refreshOrgLeadTags,
        refreshTeam,
        chithiUnread,
        refreshChithiUnread,
        markChithiSeen,
        refreshSavedLeads,
        refreshPipelineLead,
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
