import { createContext, useContext, useState, useCallback } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [screen, setScreen] = useState('landing') // landing | auth | app
  const [savedLeads, setSavedLeads] = useState([])
  const [searchHistory, setSearchHistory] = useState([])

  const login = useCallback((userData) => {
    setUser(userData)
    setScreen('app')
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setScreen('landing')
  }, [])

  const toggleSaveLead = useCallback((lead) => {
    setSavedLeads((prev) => {
      const exists = prev.some((l) => l.id === lead.id)
      if (exists) return prev.filter((l) => l.id !== lead.id)
      return [...prev, { ...lead, savedAt: new Date().toISOString() }]
    })
  }, [])

  const isSaved = useCallback(
    (id) => savedLeads.some((l) => l.id === id),
    [savedLeads]
  )

  const addSearchHistory = useCallback((entry) => {
    setSearchHistory((prev) => [entry, ...prev].slice(0, 20))
  }, [])

  return (
    <AppContext.Provider
      value={{
        user,
        screen,
        setScreen,
        login,
        logout,
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

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
