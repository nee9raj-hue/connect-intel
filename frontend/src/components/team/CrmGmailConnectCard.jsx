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
    return <p className="text-xs text-gray-500">Checking Gmail connection…</p>
  }

  if (error && !status) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
        <p className="font-semibold">Could not check Gmail status</p>
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
          Google sign-in works with the public Client ID only. <strong>Connect work Gmail</strong> also needs{' '}
          <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> on Vercel — this is separate from
          the “unverified app” screen.
        </p>
        {status?.hint && <p className="text-amber-900">{status.hint}</p>}
        {isOperator ? (
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>
              Google Cloud → Credentials → your <strong>Web</strong> OAuth client → copy <strong>Client secret</strong>
            </li>
            <li>
              Add redirect URI:{' '}
              <code className="bg-amber-100 px-1 rounded text-[10px]">
                https://connectintel.net/api/team/email-oauth/callback
              </code>
            </li>
            <li>
              Vercel → connect-intel → Environment Variables → set{' '}
              <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code>,{' '}
              <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code>,{' '}
              <code className="bg-amber-100 px-1 rounded">APP_URL=https://connectintel.net</code>
            </li>
            <li>
              <strong>Redeploy</strong> production (<code className="bg-amber-100 px-1 rounded">vercel --prod</code>)
            </li>
          </ol>
        ) : (
          <p>
            Ask whoever runs Connect Intel hosting (Vercel) to add the Google OAuth client secret and redeploy. Until
            then, use <strong>Optional: company domain DNS</strong> below for CRM sending.
          </p>
        )}
        {needsSecret && isOperator && (
          <p className="text-[10px] font-medium">Missing on server: {missing.join(', ')}</p>
        )}
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
          After connecting, open a lead → Email → <strong>Sync from Gmail</strong> to pull replies into the thread.
          Reconnect once if sync asks for read access.
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

      <details className="rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-950">
        <summary className="px-3 py-2 font-semibold cursor-pointer">
          Seeing &quot;Google hasn&apos;t verified this app&quot;?
        </summary>
        <div className="px-3 pb-3 space-y-2 border-t border-amber-200/80 pt-2 leading-relaxed">
          <p className="font-medium">For you (the person connecting):</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>On the Google warning page, click <strong>Advanced</strong> (bottom left).</li>
            <li>Click <strong>Go to Connect Intel (unsafe)</strong>.</li>
            <li>Pick your <strong>work</strong> email (e.g. sales@yourcompany.com), not personal Gmail.</li>
            <li>Click <strong>Allow</strong>.</li>
          </ol>
          <p className="text-amber-900">
            No <strong>Advanced</strong> link? Your email must be added by the Connect Intel platform admin (see
            below), or the app must finish Google verification.
          </p>
          <p className="font-medium pt-1">For platform admin (invite@connectintel.net / Google Cloud):</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              <a
                className="underline"
                href="https://console.cloud.google.com/auth/audience"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud → Audience
              </a>{' '}
              — app must be <strong>External</strong>, status <strong>Testing</strong> (or verified in Production).
            </li>
            <li>
              <strong>Test users</strong> → Add users → add each rep&apos;s exact work email (max 100).
            </li>
            <li>Wait 5 minutes, then retry in an incognito window.</li>
          </ol>
          <p className="text-[10px] text-amber-800">
            Long-term: submit <strong>gmail.send</strong> for Google OAuth verification (Verification center). Until
            then, only test users can connect reliably.
          </p>
        </div>
      </details>
    </div>
  )
}
