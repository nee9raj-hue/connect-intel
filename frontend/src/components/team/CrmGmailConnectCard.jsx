import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'

export default function CrmGmailConnectCard({ compact = false }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCrmGmailStatus()
      setStatus(data)
    } catch (e) {
      setError(e.message)
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
    return <p className="text-xs text-gray-500">Checking Gmail connection…</p>
  }

  if (!status?.configured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Gmail connect is not configured on the server (Google OAuth env vars). Contact Connect Intel support.
      </div>
    )
  }

  if (status.connected) {
    return (
      <div className={`rounded-lg border border-green-200 bg-green-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'} text-sm`}>
        <p className="font-semibold text-green-900">Work Gmail connected</p>
        <p className="text-xs text-green-800 mt-0.5">
          Sends from <strong>{status.mailbox}</strong> via Google — no DNS changes. Activity is logged in CRM.
        </p>
        <p className="text-[10px] text-green-700 mt-1">
          Inbox sync (auto-import replies) is not enabled yet — outbound send only, like early HubSpot connect.
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border-2 border-gray-900 bg-white ${compact ? 'px-3 py-3' : 'px-4 py-4'} text-sm space-y-2`}>
      <p className="font-semibold text-gray-900">Connect work Gmail (recommended)</p>
      <p className="text-xs text-gray-600 leading-relaxed">
        HubSpot-style: each rep connects their <strong>@company.com</strong> Google account once. CRM sends through
        that inbox — <strong>no DNS</strong> at your domain host.
      </p>
      {error && (
        <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded px-2 py-1">{error}</p>
      )}
      <button
        type="button"
        onClick={connect}
        disabled={connecting}
        className="w-full py-2 text-xs font-semibold bg-[#ffcb2b] text-[#242424] rounded-lg disabled:opacity-50"
      >
        {connecting ? 'Opening Google…' : 'Connect work Gmail'}
      </button>
      <p className="text-[10px] text-gray-500">
        Google may show &quot;unverified app&quot; until Connect Intel completes one-time verification — use Advanced →
        Continue, or ask your admin to add you as a test user.
      </p>
    </div>
  )
}
