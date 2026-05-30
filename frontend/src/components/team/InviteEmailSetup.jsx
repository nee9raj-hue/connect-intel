import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'

const MAILBOX = 'invite@connectintel.net'

export default function InviteEmailSetup({ onStatusChange }) {
  const [diag, setDiag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getInviteEmailDiagnostics()
      setDiag(data)
      onStatusChange?.(Boolean(data.inviteEmailReady), data)
    } catch {
      setDiag(null)
      onStatusChange?.(false, null)
    } finally {
      setLoading(false)
    }
  }, [onStatusChange])

  useEffect(() => {
    load()
  }, [load])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { url } = await api.startInviteEmailOAuth()
      window.location.href = url
    } catch (err) {
      alert(err.message)
      setConnecting(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-gray-500">Checking {MAILBOX}…</p>
  }

  if (!diag) {
    return <p className="text-xs text-red-700">Could not load email status.</p>
  }

  if (diag.inviteEmailReady) {
    return (
      <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        ✓ Invite email is connected ({diag.connectedMailbox || MAILBOX}).
      </p>
    )
  }

  if (diag.gmailOAuthConfigured) {
    return (
      <div className="rounded-lg border-2 border-[#FF773D] bg-[#fff4ee] px-4 py-4 text-sm space-y-3">
        {diag.lastOAuthError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
            <p className="font-semibold">Last connect attempt failed</p>
            <p className="mt-1 leading-relaxed">{diag.lastOAuthError}</p>
          </div>
        )}
        <p className="font-semibold text-[#242424]">One click to enable invite emails</p>
        <p className="text-xs text-[#FF773D] leading-relaxed">
          On the Google screen, pick <strong>{MAILBOX}</strong> only (not personal Gmail). If Google asks again,
          remove Connect Intel at{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
            className="underline font-medium"
          >
            myaccount.google.com/permissions
          </a>{' '}
          then connect once more.
        </p>
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="w-full py-3 bg-[#FF773D] hover:bg-[#e5652f] text-[#242424] font-bold rounded-lg text-sm disabled:opacity-60"
        >
          {connecting ? 'Opening Google…' : `Connect ${MAILBOX}`}
        </button>
        <button type="button" onClick={load} className="text-xs text-gray-600 underline w-full text-center">
          Re-check status
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 space-y-2">
      <p className="font-semibold">Company Google Cloud setup needed</p>
      <p className="leading-relaxed">
        Create OAuth in Google Cloud while signed in as <strong>{MAILBOX}</strong> (not personal email). Add{' '}
        <strong>GOOGLE_CLIENT_SECRET</strong> on Vercel, redeploy. See <strong>COMPANY-GOOGLE-SETUP.md</strong> in the
        project folder.
      </p>
    </div>
  )
}
