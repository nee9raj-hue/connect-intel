import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  rep: 'Rep',
  marketing_manager: 'Marketing manager',
  marketing_executive: 'Marketing executive',
}

export default function OrgPermissionsPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)

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

  const toggle = async (role, action, allowed) => {
    setSaving(`${role}:${action}`)
    try {
      const payload = await api.updateOrgPermission({ role, action, allowed: !allowed })
      setData(payload)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 py-8 text-center">Loading permissions…</p>
  }

  if (!data?.matrix) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        {error || 'Permissions matrix unavailable until SQL migrations are applied.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">
          {error}
        </p>
      )}
      {!data.fromSql && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Showing defaults — run org admin SQL migration to persist changes.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Action</th>
              {data.roles.map((role) => (
                <th key={role} className="px-2 py-2 font-semibold text-gray-600 text-center min-w-[72px]">
                  {ROLE_LABELS[role] || role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.actions.map((action) => (
              <tr key={action.id} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 text-gray-800">{action.label}</td>
                {data.roles.map((role) => {
                  const allowed = Boolean(data.matrix[role]?.[action.id])
                  const key = `${role}:${action.id}`
                  return (
                    <td key={key} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        disabled={saving === key}
                        onClick={() => toggle(role, action.id, allowed)}
                        className={`w-8 h-8 rounded-lg border text-sm font-bold transition-colors ${
                          allowed
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-gray-50 border-gray-200 text-gray-400'
                        } disabled:opacity-50`}
                        aria-label={`${action.label} for ${role}: ${allowed ? 'on' : 'off'}`}
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
      </div>
    </div>
  )
}
