import { useEffect, useState } from 'react'
import { AppProvider, useApp, storeInviteToken } from './context/AppContext'
import GoogleAuthRoot from './components/auth/GoogleAuthRoot'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import AppShell from './components/layout/AppShell'
import GlobalLoadingBar from './components/ui/GlobalLoadingBar'
import LoadingExperience from './components/ui/LoadingExperience'
import { LOADING_MESSAGES } from './lib/loadingQuotes'

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
      <div className="min-h-screen flex flex-col bg-[#f6f7f9]">
        <LoadingExperience message={LOADING_MESSAGES.workspace} fill className="min-h-screen" />
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
        <GlobalLoadingBar />
        <Router />
      </AppProvider>
    </GoogleAuthRoot>
  )
}
