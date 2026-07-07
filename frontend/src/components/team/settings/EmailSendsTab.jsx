import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { C } from './settingsTheme'
import { SettingsCard } from './SettingsUi'

const SOURCE_LABELS = {
  crm_1to1: 'CRM 1:1',
  crm_bulk: 'CRM bulk (Pipeline)',
  marketing_campaign: 'Marketing campaign',
}

const SOURCE_FILTER_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'crm_1to1', label: SOURCE_LABELS.crm_1to1 },
  { value: 'crm_bulk', label: SOURCE_LABELS.crm_bulk },
  { value: 'marketing_campaign', label: SOURCE_LABELS.marketing_campaign },
]

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
    const known = new Set(SOURCE_FILTER_OPTIONS.map((o) => o.value).filter(Boolean))
    const fromData = sends.map((s) => s.source).filter((s) => s && !known.has(s))
    return [...SOURCE_FILTER_OPTIONS, ...fromData.map((s) => ({ value: s, label: s }))]
  }, [sends])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SettingsCard
        title="Email send audit"
        description="Per-message log for CRM 1:1, Pipeline bulk, and Marketing campaign sends. Requires Supabase email_sends migration."
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
            {sourceOptions.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
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

        {!loading && !sends.length && !error ? (
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
            No sends logged yet. After migration, CRM and marketing sends appear here automatically.
            Ops: run <code style={{ fontSize: 12 }}>npm run email:sends-migrate</code> on Supabase.
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
                  <th style={{ padding: '8px 6px', borderBottom: `1px solid ${C.border}` }}>Campaign</th>
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
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.subject || ''}
                    >
                      {row.subject || '—'}
                    </td>
                    <td
                      style={{
                        padding: '8px 6px',
                        borderBottom: `1px solid ${C.border}`,
                        fontFamily: 'monospace',
                        fontSize: 11,
                        maxWidth: 100,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={row.campaignId || ''}
                    >
                      {row.campaignId ? String(row.campaignId).slice(0, 8) : '—'}
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
