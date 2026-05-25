import { useEffect, useState } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { resolveGoogleClientId } from '../../lib/googleAuthConfig'
import { withTimeout } from '../../lib/fetchWithTimeout'
import LoadingExperience from '../ui/LoadingExperience'

export default function GoogleAuthRoot({ children }) {
  const [clientId, setClientId] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    withTimeout(resolveGoogleClientId(), 8_000)
      .catch(() => '')
      .then((id) => {
        if (cancelled) return
        setClientId(id || '')
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setClientId('')
          setReady(true)
        }
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
