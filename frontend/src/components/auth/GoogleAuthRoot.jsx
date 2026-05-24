import { useEffect, useState } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { resolveGoogleClientId } from '../../lib/googleAuthConfig'
import LoadingExperience from '../ui/LoadingExperience'

export default function GoogleAuthRoot({ children }) {
  const [clientId, setClientId] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    resolveGoogleClientId().then((id) => {
      if (cancelled) return
      setClientId(id || '')
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f6f7f9]">
        <LoadingExperience message="Preparing sign-in…" fill className="min-h-screen" />
      </div>
    )
  }

  if (!clientId) {
    return children
  }

  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>
}
