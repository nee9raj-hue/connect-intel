import { GoogleOAuthProvider } from '@react-oauth/google'
import { AppProvider, useApp } from './context/AppContext'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import AppShell from './components/layout/AppShell'

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '')

function Router() {
  const { screen } = useApp()

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
