import { GoogleOAuthProvider } from '@react-oauth/google'
import { AppProvider, useApp } from './context/AppContext'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import AppShell from './components/layout/AppShell'

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '')

function Router() {
  const { ready, screen } = useApp()

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
  if (screen === 'auth') return <AuthPage />
  return <AppShell />
}

export default function App() {
  const content = (
    <AppProvider>
      <Router />
    </AppProvider>
  )

  if (!GOOGLE_CLIENT_ID) return content

  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{content}</GoogleOAuthProvider>
}
