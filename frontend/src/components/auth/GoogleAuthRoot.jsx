import { useEffect, useState } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { resolveGoogleClientId } from '../../lib/googleAuthConfig'

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
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f9]">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto border-2 border-[#ffcb2b]/30 border-t-[#ffcb2b] rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-600">Loading…</p>
        </div>
      </div>
    )
  }

  if (!clientId) {
    return children
  }

  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>
}
