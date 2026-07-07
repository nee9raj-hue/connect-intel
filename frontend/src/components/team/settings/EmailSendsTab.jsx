import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { C } from './settingsTheme'
import { SettingsCard } from './SettingsUi'

const SOURCE_LABELS = {
  crm_1to1: 'CRM 1:1',
  marketing_campaign: 'Marketing campaign',
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function EmailSendsTab() {
  const [sends, setSends] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getOrgEmailSends({
        limit: 80,
        source: sourceFilter || undefined,
      })
      setSends(data.sends || [])
      if (data.warning) setError(data.warning)
    } catch (err) {
      setError(err.message || 'Could not load email send log')
    } finally {
      setLoading(false)
    }
  }, [sourceFilter])

  useEffect(() => {
    load()
  }, [load])

  const sourceOptions = useMemo(() => {
    const set = new Set(sends.map((s) => s.source).filter(Boolean))
    return Array.from(set).sort()
  }, [sends])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SettingsCard
        title="Email send audit"
        description="Immutable per-message log for CRM 1:1 and marketing campaign sends (constitution P1)."
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              fontSize: 13,
              background: '#fff',
            }}
          >
            <option value="">All sources</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABELS[source] || source}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? <p style={{ fontSize: 13, color: C.textMuted }}>Loading…</p> : null}
        {error ? <p style={{ fontSize: 13, color: '#b91c1c' }}>{error}</p> : null}

        {!loading && !sends.length ? (
          <p style={{ fontSize: 13, color: C.textMuted }}>
            No sends logged yet. CRM emails and marketing campaigns appear here after the email_sends
            table is active.
          </p>
        ) : null}

        {!loading && sends.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.textMuted }}>
                  <th style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>When</th>
                  <th style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>Source</th>
                  <th style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>To</th>
                  <th style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>Subject</th>
                  <th style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sends.map((row) => (
                  <tr key={row.id || `${row.sentAt}-${row.toEmail}`}>
                    <td style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>
                      {formatWhen(row.sentAt)}
                    </td>
                    <td style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>
                      {SOURCE_LABELS[row.source] || row.source || '—'}
                    </td>
                    <td style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>
                      {row.toEmail || '—'}
                    </td>
                    <td
                      style={{
                        padding: '8px 6px',
                        borderBottom: `1px solid ${C.border}`,
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.subject || '—'}
                    </td>
                    <td style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>
                      {row.status || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SettingsCard>
    </div>
  )
}
