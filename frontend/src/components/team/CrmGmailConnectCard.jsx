import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

export default function CrmGmailConnectCard({ compact = false }) {
  const { refreshSession } = useApp()
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
      const msg = e.message || 'Could not check email connection'
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
      else setError('Could not start email authorization')
    } catch (e) {
      setError(e.message)
    } finally {
      setConnecting(false)
    }
  }

  const pad = compact ? 'px-3 py-3' : 'px-4 py-4'

  if (loading) {
    return <p className="text-xs text-gray-500">Checking email connection…</p>
  }

  if (error && !status) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 text-red-900 ${pad}`}>
        <p className="font-semibold text-xs">Could not check email status</p>
        <p className="mt-1 text-xs">{error}</p>
        <RetryActions onRetry={load} onReconnect={refreshSession} />
      </div>
    )
  }

  if (!status?.configured) {
    return (
      <div className={`rounded-lg border border-amber-200 bg-amber-50 text-amber-950 ${pad}`}>
        <p className="font-semibold text-xs">Work email is not configured yet</p>
        <p className="mt-1 text-xs leading-relaxed">
          Contact Connect Intel support to enable work email sending for your organization.
        </p>
      </div>
    )
  }

  if (!status.gmailConnectAvailable) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 text-gray-700 ${pad}`}>
        <p className="font-semibold text-xs text-gray-900">Work email connect is unavailable</p>
        <p className="mt-1 text-xs leading-relaxed">Try again later or contact Connect Intel support.</p>
      </div>
    )
  }

  if (status.connected) {
    return (
      <div className={`rounded-lg border border-green-200 bg-green-50 ${pad}`}>
        <p className="font-semibold text-sm text-green-900">Work email connected</p>
        <p className="text-xs text-green-800 mt-0.5">
          Sends from <strong>{status.mailbox}</strong> · replies sync to CRM
        </p>
        {status.needsReplySyncReconnect && (
          <button
            type="button"
            onClick={connect}
            disabled={connecting}
            className="mt-2 text-xs font-semibold text-green-900 underline disabled:opacity-60"
          >
            {connecting ? 'Connecting…' : 'Enable reply sync'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white text-sm ${pad} space-y-2`}>
      <p className="font-semibold text-gray-900">Connect work email</p>
      <p className="text-xs text-gray-600 leading-relaxed">
        Sign in once with your <strong>work</strong> email account. Send CRM email from your real mailbox.
      </p>

      {status.googleVerificationPending && (
        <div className="text-[11px] text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 space-y-1.5 leading-relaxed">
          <p className="font-semibold">Sign-in may show a security notice</p>
          <p>
            {status.googleSetup?.whyUnverifiedWarning ||
              'This is normal while Connect Intel completes email provider verification.'}
          </p>
          <p className="text-[10px] text-amber-800">
            If connection fails, choose Advanced → Continue to Connect Intel, or contact your administrator.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded px-2 py-1">{error}</p>
      )}
      <button
        type="button"
        onClick={connect}
        disabled={connecting}
        className="w-full py-2.5 text-sm font-semibold bg-[#ffcb2b] text-[#242424] rounded-lg disabled:opacity-50"
      >
        {connecting ? 'Connecting…' : 'Connect work email'}
      </button>
      <p className="text-[10px] text-gray-500">
        <a href="https://connectintel.net/privacy.html" className="underline" target="_blank" rel="noreferrer">
          Privacy policy
        </a>
      </p>
    </div>
  )
}

function RetryActions({ onRetry, onReconnect }) {
  return (
    <div className="mt-2 flex gap-3 text-xs">
      <button type="button" onClick={onRetry} className="underline font-semibold">
        Retry
      </button>
      <button
        type="button"
        onClick={async () => {
          await onReconnect?.()
          onRetry()
        }}
        className="underline font-semibold"
      >
        Reconnect session
      </button>
    </div>
  )
}
