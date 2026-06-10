import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { HIERARCHY_SQL_ROLES } from '../../lib/crmConstants'

function teamOptions(departments) {
  return (departments || []).flatMap((d) =>
    (d.teams || []).map((t) => ({
      teamId: t.id,
      departmentId: d.id,
      label: `${d.name} → ${t.name}`,
    }))
  )
}

export default function OrgHierarchyPanel({ teamMembers = [], onMembersChanged }) {
  const [hierarchy, setHierarchy] = useState({ departments: [], unassignedMembers: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [deptName, setDeptName] = useState('')
  const [teamDraft, setTeamDraft] = useState({})
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getOrgHierarchy()
      setHierarchy(data)
    } catch (err) {
      setError(err.message || 'Could not load departments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const moveOptions = useMemo(() => teamOptions(hierarchy.departments), [hierarchy.departments])

  const flash = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  const handleCreateDept = async (e) => {
    e.preventDefault()
    if (!deptName.trim()) return
    setBusy('dept')
    try {
      const data = await api.createOrgDepartment({ name: deptName.trim() })
      setHierarchy(data)
      setDeptName('')
      flash('Department created')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const handleCreateTeam = async (departmentId) => {
    const draft = teamDraft[departmentId] || {}
    if (!draft.name?.trim()) return
    setBusy(`team-${departmentId}`)
    try {
      const data = await api.createOrgTeam({
        departmentId,
        name: draft.name.trim(),
        managerUserId: draft.managerUserId || null,
      })
      setHierarchy(data)
      setTeamDraft((prev) => ({ ...prev, [departmentId]: { name: '', managerUserId: '' } }))
      flash('Team created')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const assignMember = async (userId, teamId, departmentId, sqlRole) => {
    setBusy(`assign-${userId}`)
    try {
      if (sqlRole) {
        await api.updateMemberPermissions({ userId, sqlRole, teamId, departmentId })
      } else {
        const data = await api.assignOrgMemberHierarchy({ userId, teamId, departmentId })
        setHierarchy(data)
      }
      await load()
      onMembersChanged?.()
      flash('Member updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const unassignMember = async (userId) => {
    if (!window.confirm('Remove this member from their team? They will see only their own leads.')) return
    setBusy(`unassign-${userId}`)
    try {
      await api.assignOrgMemberHierarchy({ userId, teamId: null, departmentId: null })
      await load()
      onMembersChanged?.()
      flash('Member unassigned')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const deleteDept = async (dept) => {
    if (!window.confirm(`Delete department "${dept.name}"? All teams must be removed first.`)) return
    setBusy(`del-dept-${dept.id}`)
    try {
      const data = await api.deleteOrgDepartment(dept.id)
      setHierarchy(data)
      flash('Department deleted')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const deleteTeam = async (team, deptName) => {
    if (!window.confirm(`Delete team "${team.name}" in ${deptName}? Reassign members first.`)) return
    setBusy(`del-team-${team.id}`)
    try {
      const data = await api.deleteOrgTeam(team.id)
      setHierarchy(data)
      flash('Team deleted')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const renderMemberRow = (m, { showUnassign = false } = {}) => (
    <li
      key={m.userId}
      className="flex flex-wrap items-center gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0"
    >
      <span className="font-medium text-gray-900 min-w-[120px]">{m.name}</span>
      <select
        value={m.role || 'rep'}
        disabled={busy === `assign-${m.userId}`}
        onChange={(e) => {
          const teamId = m.teamId || null
          const departmentId = m.departmentId || null
          assignMember(m.userId, teamId, departmentId, e.target.value)
        }}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1"
        aria-label={`Role for ${m.name}`}
      >
        {HIERARCHY_SQL_ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <select
        className="text-xs border border-gray-200 rounded-lg px-2 py-1 flex-1 min-w-[160px]"
        value={m.teamId ? `${m.teamId}|${m.departmentId || ''}` : ''}
        disabled={busy === `assign-${m.userId}`}
        onChange={(e) => {
          const val = e.target.value
          if (!val) return
          const [teamId, departmentId] = val.split('|')
          assignMember(m.userId, teamId, departmentId || null, m.role)
        }}
      >
        <option value="">Move to team…</option>
        {moveOptions.map((opt) => (
          <option key={opt.teamId} value={`${opt.teamId}|${opt.departmentId}`}>
            {opt.label}
          </option>
        ))}
      </select>
      {showUnassign && m.teamId && (
        <button
          type="button"
          onClick={() => unassignMember(m.userId)}
          className="text-xs text-gray-500 hover:text-red-700 underline"
        >
          Unassign
        </button>
      )}
    </li>
  )

  if (loading) {
    return <p className="text-sm text-gray-500 py-8 text-center">Loading departments…</p>
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleCreateDept} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1">New department</label>
          <input
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            placeholder="e.g. Sales"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy === 'dept'}
          className="text-sm font-semibold px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
        >
          Add department
        </button>
      </form>

      {!hierarchy.departments?.length ? (
        <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-xl">
          No departments yet. Create one to organize teams and reps.
        </p>
      ) : (
        hierarchy.departments.map((dept) => (
          <div key={dept.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{dept.name}</h3>
                <span className="text-xs text-gray-500">{dept.teams?.length || 0} teams</span>
              </div>
              <button
                type="button"
                onClick={() => deleteDept(dept)}
                disabled={busy === `del-dept-${dept.id}`}
                className="text-xs font-semibold text-red-700 hover:text-red-900 px-2 py-1 rounded-lg hover:bg-red-50"
              >
                Delete
              </button>
            </div>
            <div className="p-4 space-y-4">
              {(dept.teams || []).map((team) => (
                <div key={team.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{team.name}</p>
                      <p className="text-xs text-gray-500">
                        {team.memberCount} members · {team.openLeadCount} open leads
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTeam(team, dept.name)}
                      disabled={busy === `del-team-${team.id}`}
                      className="text-xs font-semibold text-red-600 hover:text-red-800"
                    >
                      Delete team
                    </button>
                  </div>
                  {team.members?.length > 0 ? (
                    <ul className="mt-2 rounded-lg bg-gray-50/80 px-2 py-1">
                      {team.members.map((m) => renderMemberRow(m, { showUnassign: true }))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No members assigned</p>
                  )}
                </div>
              ))}

              <div className="rounded-lg border border-dashed border-gray-200 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600">Add team</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={teamDraft[dept.id]?.name || ''}
                    onChange={(e) =>
                      setTeamDraft((prev) => ({
                        ...prev,
                        [dept.id]: { ...prev[dept.id], name: e.target.value },
                      }))
                    }
                    placeholder="Team name"
                    className="flex-1 min-w-[140px] px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                  />
                  <select
                    value={teamDraft[dept.id]?.managerUserId || ''}
                    onChange={(e) =>
                      setTeamDraft((prev) => ({
                        ...prev,
                        [dept.id]: { ...prev[dept.id], managerUserId: e.target.value },
                      }))
                    }
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Manager (optional)</option>
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleCreateTeam(dept.id)}
                    disabled={busy === `team-${dept.id}`}
                    className="text-xs font-semibold px-3 py-1.5 bg-[#FF773D] text-[#242424] rounded-lg disabled:opacity-50"
                  >
                    Create team
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      {hierarchy.unassignedMembers?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h3 className="text-sm font-semibold text-amber-950 mb-2">Unassigned members</h3>
          <ul className="rounded-lg bg-white/60 px-2 py-1">
            {hierarchy.unassignedMembers.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-2 text-sm py-1.5">
                <span className="font-medium text-gray-900">{m.name}</span>
                <select
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1"
                  defaultValue=""
                  disabled={busy === `assign-${m.userId}`}
                  onChange={(e) => {
                    const val = e.target.value
                    if (!val) return
                    const [teamId, departmentId] = val.split('|')
                    assignMember(m.userId, teamId, departmentId, m.role || 'rep')
                    e.target.value = ''
                  }}
                >
                  <option value="">Assign to team…</option>
                  {moveOptions.map((opt) => (
                    <option key={opt.teamId} value={`${opt.teamId}|${opt.departmentId}`}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
