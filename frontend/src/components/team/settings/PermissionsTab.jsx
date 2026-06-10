import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { C } from './settingsTheme'
import { SettingsCard } from './SettingsUi'

const ROLE_LABELS = {
  admin: 'Org Admin',
  manager: 'Manager',
  rep: 'Rep',
  marketing_manager: 'Marketing Manager',
  marketing_executive: 'Marketing Executive',
}

const TOOLTIPS = {
  view_all_leads: 'Reps see only their assigned leads unless enabled',
  edit_leads: 'Edit lead records and CRM fields',
  delete_leads: 'Permanently delete leads',
  export_leads: 'Export pipeline data to CSV',
  manage_team: 'Invite members and change roles',
  access_marketing: 'Open Marketing Hub',
  send_campaigns: 'Send bulk email campaigns',
  view_analytics: 'View dashboards and reports',
  manage_billing: 'Manage subscription and invoices',
}

export default function PermissionsTab({ teamMembers }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)
  const [warning, setWarning] = useState(null)
  const [dismissWarning, setDismissWarning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = await api.getOrgPermissions()
      setData(payload)
    } catch (err) {
      setError(err.message || 'Could not load permissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const countAffectedReps = (role, action, nextAllowed) => {
    if (nextAllowed || role !== 'rep' || action !== 'view_all_leads') return 0
    return teamMembers.filter((m) => m.sqlRole === 'rep' || (!m.sqlRole && m.role !== 'org_admin')).length
  }

  const toggle = async (role, action, allowed) => {
    if (role === 'admin') return
    const next = !allowed
    const affected = countAffectedReps(role, action, next)
    if (affected > 0) {
      setWarning(`This will remove access for ${affected} rep${affected === 1 ? '' : 's'} currently active. Changes save immediately.`)
      setDismissWarning(false)
    }
    setSaving(`${role}:${action}`)
    try {
      const payload = await api.updateOrgPermission({ role, action, allowed: next })
      setData(payload)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 40 }}>Loading permissions…</p>
  }

  if (!data?.matrix) {
    return (
      <SettingsCard>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, textAlign: 'center' }}>
          {error || 'Permissions matrix unavailable until SQL migrations are applied.'}
        </p>
      </SettingsCard>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {warning && !dismissWarning && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: '#faeeda', borderRadius: 8, fontSize: 12, color: '#633806' }}>
          <span>{warning}</span>
          <button type="button" onClick={() => setDismissWarning(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>Dismiss</button>
        </div>
      )}
      {error && (
        <p style={{ fontSize: 12, color: '#791f1f', margin: 0 }}>{error}</p>
      )}
      <SettingsCard style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: '#f9f9f7', borderBottom: `0.5px solid ${C.border}` }}>
              <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted }}>
                Role
              </th>
              {data.actions.map((action) => (
                <th
                  key={action.id}
                  title={TOOLTIPS[action.id] || action.label}
                  style={{ padding: '11px 8px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted, textAlign: 'center', minWidth: 72 }}
                >
                  {action.label.replace(' ', '\n')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.roles.map((role) => (
              <tr key={role} style={{ borderBottom: `0.5px solid ${C.border}` }}>
                <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 500, color: C.text }}>
                  {ROLE_LABELS[role] || role}
                </td>
                {data.actions.map((action) => {
                  const allowed = Boolean(data.matrix[role]?.[action.id])
                  const locked = role === 'admin'
                  const key = `${role}:${action.id}`
                  return (
                    <td key={key} style={{ padding: '11px 8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        disabled={locked || saving === key}
                        title={TOOLTIPS[action.id]}
                        onClick={() => toggle(role, action.id, allowed)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: 'none',
                          cursor: locked ? 'default' : 'pointer',
                          background: allowed ? '#eaf3de' : '#f0f0ee',
                          color: allowed ? '#27500a' : C.textMuted,
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        {allowed ? '✓' : '—'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsCard>
    </div>
  )
}
