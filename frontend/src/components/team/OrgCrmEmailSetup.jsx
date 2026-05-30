import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

export default function OrgCrmEmailSetup() {
  const { refreshSession } = useApp()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const autoTried = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getOrgEmailDomain()
      setStatus(data)
    } catch (e) {
      setError(e.message)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const runAutoSetup = useCallback(async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const data = await api.setupOrgEmailDomain({ action: 'auto_setup' })
      setStatus(data)
      if (data.justCreated) {
        setNotice(`Domain ${data.domain} registered — add the DNS records below, then check verification.`)
      } else if (data.verified) {
        setNotice('Your company can send CRM email to unlimited teammates automatically.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load().then(() => {})
  }, [load])

  useEffect(() => {
    if (loading || autoTried.current || !status || status.configured) return
    autoTried.current = true
    runAutoSetup()
  }, [status, loading, runAutoSetup])

  const handleVerify = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const data = await api.setupOrgEmailDomain({ action: 'verify' })
      setStatus(data)
      if (data.verified) {
        setNotice('Domain verified — all reps on your company domain can send from CRM.')
        await refreshSession?.()
      } else {
        setNotice('DNS not verified yet. Wait a few minutes after adding records, then check again.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !status) {
    return <p className="text-xs text-gray-500">Setting up outbound email…</p>
  }

  if (status?.verified) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm space-y-1">
        <p className="font-semibold text-green-900">Outbound email ready</p>
        <p className="text-xs text-green-800">
          CRM sends from each rep&apos;s address <strong>@{(status.domain)}</strong> for your whole team.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border-2 border-[#FF773D] bg-[#fff4ee] px-4 py-4 text-sm space-y-3">
      <div>
        <p className="font-semibold text-[#242424]">Optional DNS sending</p>
        <p className="text-xs text-[#FF773D] mt-1 leading-relaxed">
          Only if you cannot use work email connect above. We register{' '}
          <strong>{status?.domain || status?.inferredDomain || 'your company domain'}</strong> — add DNS once for all
          reps on <strong>@{status?.domain || 'yourcompany.com'}</strong>.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">{error}</p>
      )}
      {notice && (
        <p className="text-xs text-green-900 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">{notice}</p>
      )}

      {!status?.configured && (
        <button
          type="button"
          disabled={busy}
          onClick={runAutoSetup}
          className="w-full py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Set up sending domain'}
        </button>
      )}

      {status?.records?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">DNS records (add at your domain host)</p>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {status.records.map((r, i) => (
              <li key={`${r.host}-${i}`} className="text-xs bg-white border rounded p-2 font-mono break-all">
                <div className="text-gray-500">{r.purpose} · {r.type}</div>
                <div className="font-semibold text-gray-800">{r.host}</div>
                <div className="text-gray-700">{r.value}</div>
                {r.priority != null && <div className="text-gray-400">priority {r.priority}</div>}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={handleVerify}
            className="w-full py-2 text-xs font-semibold border-2 border-[#FF773D] rounded-lg disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Check DNS verification'}
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500 leading-relaxed">
        Most teams should use <strong>Connect work email</strong> above instead of DNS.
      </p>
    </div>
  )
}
