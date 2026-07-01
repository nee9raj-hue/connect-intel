import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { C } from './settingsTheme'
import { SettingsCard } from './SettingsUi'

const OUTCOME_STYLES = {
  success: { bg: '#eaf3de', color: '#27500a', label: 'Success' },
  denied: { bg: '#fcebeb', color: '#791f1f', label: 'Denied' },
  failure: { bg: '#fcebeb', color: '#791f1f', label: 'Failed' },
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

function actionLabel(action) {
  if (!action) return '—'
  return String(action).replace(/[._]/g, ' ')
}

export default function AuditLogTab({ teamMembers = [] }) {
  const [events, setEvents] = useState([])
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionFilter, setActionFilter] = useState('')
  const [view, setView] = useState('audit')

  const memberNames = useMemo(() => {
    const map = new Map()
    for (const m of teamMembers) {
      if (m.userId) map.set(m.userId, m.name || m.email || m.userId)
    }
    return map
  }, [teamMembers])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [audit, workflow] = await Promise.all([
        api.getOrgAuditLog({ limit: 80, action: actionFilter || undefined }),
        api.getWorkflowRuns({ limit: 40 }),
      ])
      setEvents(audit.events || [])
      setRuns(workflow.runs || [])
      if (audit.warning || workflow.warning) {
        setError(audit.warning || workflow.warning)
      }
    } catch (err) {
      setError(err.message || 'Could not load audit data')
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => {
    load()
  }, [load])

  const actionOptions = useMemo(() => {
    const set = new Set(events.map((e) => e.action).filter(Boolean))
    return Array.from(set).sort()
  }, [events])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SettingsCard
        title="Security & workflow audit"
        description="Immutable log of permission denials, team changes, and workflow dispatches. Requires Supabase audit tables in production."
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'audit', label: 'Audit events' },
            { id: 'workflows', label: 'Workflow runs' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${view === tab.id ? C.accent : C.border}`,
                background: view === tab.id ? '#fff4ee' : '#fff',
                color: view === tab.id ? C.accent : C.textSecondary,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
          {view === 'audit' && (
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}
            >
              <option value="">All actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a)}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={load}
            style={{
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: '#fff',
              cursor: 'pointer',
              marginLeft: view === 'audit' ? 0 : 'auto',
            }}
          >
            Refresh
          </button>
        </div>

        {loading && (
          <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 24 }}>
            Loading audit log…
          </p>
        )}

        {!loading && error && (
          <p style={{ fontSize: 12, color: '#b45309', marginBottom: 12 }}>{error}</p>
        )}

        {!loading && view === 'audit' && events.length === 0 && (
          <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 24 }}>
            No audit events yet. Apply the audit_events migration in Supabase to enable logging.
          </p>
        )}

        {!loading && view === 'workflows' && runs.length === 0 && (
          <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 24 }}>
            No workflow runs recorded yet.
          </p>
        )}

        {!loading && view === 'audit' && events.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>When</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>Actor</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>Resource</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {events.map((row) => {
                  const outcome = OUTCOME_STYLES[row.outcome] || OUTCOME_STYLES.success
                  const actor =
                    memberNames.get(row.actor_legacy_user_id) || row.actor_legacy_user_id || 'System'
                  return (
                    <tr key={row.id} style={{ borderBottom: `0.5px solid ${C.border}` }}>
                      <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>{formatWhen(row.created_at)}</td>
                      <td style={{ padding: '10px 6px' }}>{actionLabel(row.action)}</td>
                      <td style={{ padding: '10px 6px', color: C.textSecondary }}>{actor}</td>
                      <td style={{ padding: '10px 6px', color: C.textSecondary }}>
                        {[row.resource_type, row.resource_id].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: outcome.bg,
                            color: outcome.color,
                          }}
                        >
                          {outcome.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && view === 'workflows' && runs.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>When</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>Trigger</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>Workflow</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>Lead</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((row) => (
                  <tr key={row.id} style={{ borderBottom: `0.5px solid ${C.border}` }}>
                    <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>{formatWhen(row.created_at)}</td>
                    <td style={{ padding: '10px 6px' }}>{actionLabel(row.trigger_type)}</td>
                    <td style={{ padding: '10px 6px', color: C.textSecondary }}>
                      {row.workflow_key || '—'}
                    </td>
                    <td style={{ padding: '10px 6px', color: C.textSecondary }}>{row.lead_id || '—'}</td>
                    <td style={{ padding: '10px 6px' }}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
