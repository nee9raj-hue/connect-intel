import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { useGmailOnboardingConfig } from '../../lib/gmailOnboarding'

const STORAGE_KEY = 'ci_gmail_setup_done'

export function markGmailSetupDone() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

export function useGmailSetupNeeded(user) {
  const { promptEnabled } = useGmailOnboardingConfig()
  const [needed, setNeeded] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!promptEnabled || !user?.onboardingComplete || user?.isPlatformAdmin) {
      setNeeded(false)
      return
    }

    let cancelled = false
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') {
        setNeeded(false)
        return
      }
    } catch {
      // continue
    }

    api
      .getCrmGmailStatus()
      .then((data) => {
        if (cancelled) return
        setStatus(data)
        if (!data.gmailConnectAvailable) {
          setNeeded(false)
          return
        }
        const ready = data.connected && (data.inboundReplySync || data.replySyncEnabled)
        if (ready) {
          markGmailSetupDone()
          setNeeded(false)
        } else {
          setNeeded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setNeeded(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.onboardingComplete, user?.isPlatformAdmin, promptEnabled])

  return { needed, status, setNeeded }
}

export default function GmailSetupModal({ onDone }) {
  const { user } = useApp()
  const { phase } = useGmailOnboardingConfig()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)

  const loadStatus = useCallback(() => {
    api
      .getCrmGmailStatus()
      .then((data) => {
        setStatus(data)
        if (data.connected && data.replySyncEnabled) {
          markGmailSetupDone()
          onDone?.()
        }
      })
      .catch(() => {})
  }, [onDone])

  useEffect(() => {
    loadStatus()
    const params = new URLSearchParams(window.location.search)
    if (params.get('crm_gmail') === 'connected') {
      loadStatus()
    }
  }, [loadStatus])

  const connect = async () => {
    setConnecting(true)
    setError(null)
    try {
      await api.touchSession()
      const data = await api.startCrmGmailOAuth()
      if (data.url) window.location.href = data.url
      else setError('Could not start email authorization')
    } catch (e) {
      setError(e.message)
    } finally {
      setConnecting(false)
    }
  }

  const skip = () => {
    markGmailSetupDone()
    onDone?.()
  }

  const isAdmin = Boolean(user?.isOrgAdmin)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Connect your work email</h2>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">
            Connect once to send from CRM. Lead replies appear in the CRM timeline and are forwarded to your work
            inbox — only send permission is required (no Gmail read access).
          </p>
        </div>

        {phase === 'testing' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 leading-relaxed">
            <p className="font-semibold">Google verification in progress</p>
            <p className="mt-1">
              If Google blocks sign-in, your admin must add your work email as a test user in Google Cloud, or use
              Advanced → Go to Connect Intel.
            </p>
          </div>
        )}

        {!isAdmin && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950 leading-relaxed">
            <p className="font-semibold">Before you connect</p>
            <p className="mt-1">
              Use your company email address (<strong>{user?.email}</strong>). If sign-in is blocked, ask your
              administrator or Connect Intel support for help.
            </p>
          </div>
        )}

        {isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 leading-relaxed">
            <p className="font-semibold">For your team</p>
            <p className="mt-1">
              Each teammate should connect their own <strong>work email</strong> from Team or Pipeline → Email.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded px-2 py-1.5">{error}</p>
        )}

        <button
          type="button"
          onClick={connect}
          disabled={connecting}
          className="w-full py-2.5 text-sm font-semibold bg-[#FF773D] text-[#242424] rounded-lg disabled:opacity-50"
        >
          {connecting ? 'Connecting…' : 'Connect work email'}
        </button>

        <button type="button" onClick={skip} className="w-full text-xs text-gray-500 underline">
          Skip for now — connect later under Work email in the sidebar
        </button>
      </div>
    </div>
  )
}
