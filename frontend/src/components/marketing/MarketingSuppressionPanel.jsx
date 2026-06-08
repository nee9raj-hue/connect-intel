import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import LoadingExperience from '../ui/LoadingExperience'

const REASON_LABELS = {
  unsubscribe: 'Unsubscribed',
  bounce: 'Bounced',
  complaint: 'Spam complaint',
  manual: 'Manual block',
  blocked: 'Blocked',
}

export default function MarketingSuppressionPanel({ user, permissions }) {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [addEmail, setAddEmail] = useState('')

  const canManage = permissions?.canManageSuppressions || user?.isOrgAdmin

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getMarketingSuppressions({ search, reason })
      setRows(res.suppressions || [])
      setSummary(res.summary || {})
      setTotal(res.total || 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [search, reason])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async () => {
    if (!addEmail.trim()) return
    setBusy(true)
    try {
      await api.addMarketingSuppression({ email: addEmail.trim(), reason: 'manual' })
      setAddEmail('')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (email) => {
    if (!window.confirm(`Remove ${email} from suppression list?`)) return
    setBusy(true)
    try {
      await api.removeMarketingSuppression(email)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () => {
    const lines = ['email,reason,createdAt', ...rows.map((r) => `${r.email},${r.reason},${r.createdAt}`)]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'marketing-suppressions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !rows.length) {
    return <LoadingExperience label="Loading suppression list…" />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="crm-section-title mb-1">Suppression list</h2>
          <p className="text-xs text-[#516f90]">
            {total} suppressed — unsubscribes, bounces, and complaints are never emailed again.
          </p>
        </div>
        <button type="button" className="ci-btn ci-btn-secondary !text-xs" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(summary).map(([key, count]) => (
          <span key={key} className="marketing-summary-pill">
            {REASON_LABELS[key] || key}: <strong>{count}</strong>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email…"
          className="ci-input flex-1 min-w-[12rem]"
        />
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="ci-input">
          <option value="">All reasons</option>
          {Object.entries(REASON_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <input
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder="Block email manually"
            className="ci-input flex-1 min-w-[12rem]"
          />
          <button type="button" className="ci-btn ci-btn-accent" disabled={busy} onClick={handleAdd}>
            Add
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto">
        <table className="crm-table w-full text-sm">
          <thead>
            <tr>
              <th>Email</th>
              <th>Reason</th>
              <th>Date</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.email}</td>
                <td>{REASON_LABELS[r.reason] || r.reason}</td>
                <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                {canManage && (
                  <td>
                    <button
                      type="button"
                      className="crm-link-btn p-0 text-red-800"
                      disabled={busy}
                      onClick={() => handleRemove(r.email)}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="text-xs text-gray-500 p-3">No suppressions match your filters.</p>}
      </div>
    </div>
  )
}
