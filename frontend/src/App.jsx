import { useEffect, useState } from 'react'
import { AppProvider, useApp, storeInviteToken } from './context/AppContext'
import GoogleAuthRoot from './components/auth/GoogleAuthRoot'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import AppShell from './components/layout/AppShell'

function useInviteToken() {
  const [token, setToken] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    if (invite) {
      setToken(invite)
      storeInviteToken(invite)
      const url = new URL(window.location.href)
      url.searchParams.delete('invite')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [])

  return token
}

function Router() {
  const { ready, screen, setScreen } = useApp()
  const inviteToken = useInviteToken()

  useEffect(() => {
    if (inviteToken && screen === 'landing') {
      setScreen('auth')
    }
  }, [inviteToken, screen, setScreen])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f9]">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto border-2 border-[#ffcb2b]/30 border-t-[#ffcb2b] rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium text-gray-700">Loading workspace…</p>
        </div>
      </div>
    )
  }

  if (screen === 'landing') return <LandingPage />
  if (screen === 'auth') return <AuthPage inviteToken={inviteToken} />
  return <AppShell />
}

export default function App() {
  return (
    <GoogleAuthRoot>
      <AppProvider>
        <Router />
      </AppProvider>
    </GoogleAuthRoot>
  )
}
