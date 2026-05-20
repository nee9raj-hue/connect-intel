import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [screen, setScreen] = useState('landing') // landing | auth | app
  const [savedLeads, setSavedLeads] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [ready, setReady] = useState(false)

  const refreshSession = useCallback(async () => {
    const session = await api.getSession()
    if (session.user) {
      setUser(session.user)
      setScreen('app')
    } else {
      setUser(null)
      setScreen('landing')
    }
    return session.user
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const session = await api.getSession()
        if (cancelled) return

        if (session.user) {
          setUser(session.user)
          setScreen('app')
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
      } catch {
        if (!cancelled) {
          setSavedLeads([])
          setSearchHistory([])
        }
      }
    }

    loadWorkspace()
    return () => {
      cancelled = true
    }
  }, [user])

  const login = useCallback(async (payload) => {
    const session = await api.createSession(payload)
    setUser(session.user)
    setScreen('app')
    return session.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.destroySession()
    } catch {
      // Keep the client state moving even if the network call fails.
    }
    setUser(null)
    setSavedLeads([])
    setSearchHistory([])
    setScreen('landing')
  }, [])

  const toggleSaveLead = useCallback(async (lead) => {
    let previous = []

    setSavedLeads((current) => {
      previous = current
      const exists = current.some((entry) => entry.id === lead.id)
      return exists
        ? current.filter((entry) => entry.id !== lead.id)
        : [...current, { ...lead, savedAt: new Date().toISOString() }]
    })

    try {
      const exists = previous.some((entry) => entry.id === lead.id)
      const data = exists ? await api.removeLead(lead.id) : await api.saveLead(lead)
      setSavedLeads(data.leads || [])
    } catch {
      setSavedLeads(previous)
    }
  }, [])

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
        updateUser,
        savedLeads,
        toggleSaveLead,
        isSaved,
        searchHistory,
        addSearchHistory,
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
