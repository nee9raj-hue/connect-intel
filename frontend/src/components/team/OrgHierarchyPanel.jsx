import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'

export default function OrgHierarchyPanel({ teamMembers = [] }) {
  const [hierarchy, setHierarchy] = useState({ departments: [], unassignedMembers: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [deptName, setDeptName] = useState('')
  const [teamDraft, setTeamDraft] = useState({})

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

  const handleCreateDept = async (e) => {
    e.preventDefault()
    if (!deptName.trim()) return
    try {
      const data = await api.createOrgDepartment({ name: deptName.trim() })
      setHierarchy(data)
      setDeptName('')
      setNotice('Department created')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCreateTeam = async (departmentId) => {
    const draft = teamDraft[departmentId] || {}
    if (!draft.name?.trim()) return
    try {
      const data = await api.createOrgTeam({
        departmentId,
        name: draft.name.trim(),
        managerUserId: draft.managerUserId || null,
      })
      setHierarchy(data)
      setTeamDraft((prev) => ({ ...prev, [departmentId]: { name: '', managerUserId: '' } }))
      setNotice('Team created')
    } catch (err) {
      setError(err.message)
    }
  }

  const assignMember = async (userId, teamId, departmentId) => {
    try {
      const data = await api.assignOrgMemberHierarchy({ userId, teamId, departmentId })
      setHierarchy(data)
      setNotice('Member assigned')
    } catch (err) {
      setError(err.message)
    }
  }

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
        <button type="submit" className="text-sm font-semibold px-4 py-2 bg-gray-900 text-white rounded-lg">
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
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{dept.name}</h3>
              <span className="text-xs text-gray-500">{dept.teams?.length || 0} teams</span>
            </div>
            <div className="p-4 space-y-4">
              {(dept.teams || []).map((team) => (
                <div key={team.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{team.name}</p>
                      <p className="text-xs text-gray-500">
                        {team.memberCount} members · {team.openLeadCount} open leads
                      </p>
                    </div>
                  </div>
                  {team.members?.length > 0 && (
                    <ul className="text-xs text-gray-600 space-y-1 mb-2">
                      {team.members.map((m) => (
                        <li key={m.userId}>
                          {m.name} <span className="text-gray-400">({m.role})</span>
                        </li>
                      ))}
                    </ul>
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
                    className="text-xs font-semibold px-3 py-1.5 bg-[#FF773D] text-[#242424] rounded-lg"
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
          <ul className="space-y-2">
            {hierarchy.unassignedMembers.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-gray-900">{m.name}</span>
                <select
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1"
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value
                    if (!val) return
                    const [teamId, departmentId] = val.split('|')
                    assignMember(m.userId, teamId, departmentId)
                    e.target.value = ''
                  }}
                >
                  <option value="">Assign to team…</option>
                  {hierarchy.departments.flatMap((d) =>
                    (d.teams || []).map((t) => (
                      <option key={t.id} value={`${t.id}|${d.id}`}>
                        {d.name} → {t.name}
                      </option>
                    ))
                  )}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
