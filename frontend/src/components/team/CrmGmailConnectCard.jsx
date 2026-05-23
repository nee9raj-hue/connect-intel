import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

export default function CrmGmailConnectCard({ compact = false }) {
  const { user, refreshSession } = useApp()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await api.touchSession()
      const data = await api.getCrmGmailStatus()
      setStatus(data)
    } catch (e) {
      const msg = e.message || 'Could not check Gmail status'
      setError(
        e.status === 401
          ? `${msg} Try Reconnect below, or sign out and sign in again.`
          : msg
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const params = new URLSearchParams(window.location.search)
    if (params.get('crm_gmail') === 'connected') {
      load()
    }
  }, [load])

  const connect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const data = await api.startCrmGmailOAuth()
      if (data.url) window.location.href = data.url
      else setError('Could not start Google authorization')
    } catch (e) {
      setError(e.message)
    } finally {
      setConnecting(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-gray-500">Checking email options…</p>
  }

  if (error && !status) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
        <p className="font-semibold">Could not check email status</p>
        <p className="mt-1">{error}</p>
        <div className="mt-2 flex gap-3">
          <button type="button" onClick={load} className="underline font-semibold">
            Retry
          </button>
          <button
            type="button"
            onClick={async () => {
              await refreshSession?.()
              load()
            }}
            className="underline font-semibold"
          >
            Reconnect session
          </button>
        </div>
      </div>
    )
  }

  if (!status?.configured) {
    const missing = status?.diagnostics?.missingEnv || []
    const needsSecret = missing.includes('GOOGLE_CLIENT_SECRET')
    const isOperator = Boolean(user?.isPlatformAdmin)

    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-950 space-y-2">
        <p className="font-semibold">Gmail connect is not enabled on the server yet</p>
        <p className="leading-relaxed">
          Use <strong>Company domain (DNS)</strong> below for customer sending until Google OAuth is configured on
          Vercel.
        </p>
        {status?.hint && <p className="text-amber-900">{status.hint}</p>}
        {isOperator && (
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>Add <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> on Vercel and redeploy</li>
            <li>Complete Google app verification (see GOOGLE-OAUTH-VERIFICATION-SUBMIT.md)</li>
          </ol>
        )}
        {needsSecret && isOperator && (
          <p className="text-[10px] font-medium">Missing on server: {missing.join(', ')}</p>
        )}
      </div>
    )
  }

  if (status.googleVerificationPending && !status.gmailConnectAvailable) {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-gray-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'} text-xs text-gray-700`}
      >
        <p className="font-semibold text-gray-900">Per-user Gmail connect — coming soon</p>
        <p className="mt-1 leading-relaxed">
          Your team sends through <strong>Company domain (DNS)</strong> below — the professional path with no Google
          warning screens. Individual Gmail connect will appear after Connect Intel completes Google&apos;s app review.
        </p>
      </div>
    )
  }

  if (status.connected) {
    return (
      <div className={`rounded-lg border border-green-200 bg-green-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'} text-sm`}>
        <p className="font-semibold text-green-900">Work Gmail connected</p>
        <p className="text-xs text-green-800 mt-0.5">
          Sends from <strong>{status.mailbox}</strong>. Activity is logged in CRM.
        </p>
      </div>
    )
  }

  if (!status.gmailConnectAvailable) {
    return null
  }

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white ${compact ? 'px-3 py-3' : 'px-4 py-4'} text-sm space-y-2`}
    >
      <p className="font-semibold text-gray-900">Connect work Gmail (optional)</p>
      <p className="text-xs text-gray-600 leading-relaxed">
        For platform testing only until Google verification is complete. Customers should use company domain DNS
        above.
      </p>
      {error && (
        <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded px-2 py-1">{error}</p>
      )}
      <button
        type="button"
        onClick={connect}
        disabled={connecting}
        className="w-full py-2 text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 rounded-lg disabled:opacity-50"
      >
        {connecting ? 'Opening Google…' : 'Connect work Gmail (operator)'}
      </button>
      {user?.isPlatformAdmin && status.googleVerificationPending && (
        <p className="text-[10px] text-gray-500 leading-relaxed">
          After Google approves the app, set <code className="bg-gray-100 px-1 rounded">GOOGLE_OAUTH_VERIFIED=true</code>{' '}
          on Vercel. See GOOGLE-OAUTH-VERIFICATION-SUBMIT.md in the repo.
        </p>
      )}
    </div>
  )
}
