import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { C, memberInitials } from './settingsTheme'
import { PrimaryButton, SettingsCard, SettingsInput, SettingsSelect, TextButton } from './SettingsUi'

export default function TeamsDepartmentsTab({ teamMembers, onMembersChanged }) {
  const [hierarchy, setHierarchy] = useState({ departments: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [deptName, setDeptName] = useState('')
  const [teamDraft, setTeamDraft] = useState({ name: '', managerUserId: '', description: '' })
  const [newTeamByDept, setNewTeamByDept] = useState({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getOrgHierarchy()
      setHierarchy(data)
      const exp = {}
      for (const d of data.departments || []) exp[d.id] = true
      setExpanded(exp)
    } catch (err) {
      setError(err.message || 'Could not load departments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flatTeams = useMemo(() => {
    const list = []
    for (const d of hierarchy.departments || []) {
      for (const t of d.teams || []) {
        list.push({ ...t, departmentId: d.id, departmentName: d.name })
      }
    }
    return list
  }, [hierarchy])

  useEffect(() => {
    if (!selectedTeam) return
    const fresh = flatTeams.find((t) => t.id === selectedTeam.id)
    if (fresh) setSelectedTeam(fresh)
  }, [flatTeams, selectedTeam?.id])

  const handleCreateDept = async (e) => {
    e.preventDefault()
    if (!deptName.trim()) return
    setBusy(true)
    try {
      const data = await api.createOrgDepartment({ name: deptName.trim() })
      setHierarchy(data)
      setDeptName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveTeam = async () => {
    if (!selectedTeam) return
    setBusy(true)
    try {
      const data = await api.updateOrgTeam({
        id: selectedTeam.id,
        name: teamDraft.name || selectedTeam.name,
        managerUserId: teamDraft.managerUserId || null,
        departmentId: teamDraft.departmentId || selectedTeam.departmentId,
      })
      setHierarchy(data)
      await load()
      onMembersChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const selectTeam = (team, dept) => {
    setSelectedTeam({ ...team, departmentId: dept.id, departmentName: dept.name })
    setTeamDraft({
      name: team.name,
      managerUserId: team.managerUserId || '',
      departmentId: dept.id,
      description: team.description || '',
    })
  }

  const addMemberToTeam = async (userId) => {
    if (!selectedTeam) return
    setBusy(true)
    try {
      await api.assignOrgMemberHierarchy({
        userId,
        teamId: selectedTeam.id,
        departmentId: selectedTeam.departmentId,
      })
      await load()
      onMembersChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const deleteDept = async (dept) => {
    if (!window.confirm(`Delete department "${dept.name}"?`)) return
    setBusy(true)
    try {
      const data = await api.deleteOrgDepartment(dept.id)
      setHierarchy(data)
      if (selectedTeam?.departmentId === dept.id) setSelectedTeam(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const deleteTeam = async (team) => {
    if (!window.confirm(`Delete team "${team.name}"?`)) return
    setBusy(true)
    try {
      const data = await api.deleteOrgTeam(team.id)
      setHierarchy(data)
      if (selectedTeam?.id === team.id) setSelectedTeam(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const unassigned = useMemo(() => {
    const inTeam = new Set()
    for (const d of hierarchy.departments || []) {
      for (const t of d.teams || []) {
        for (const m of t.members || []) inTeam.add(m.userId)
      }
    }
    return teamMembers.filter((m) => !inTeam.has(m.userId))
  }, [hierarchy, teamMembers])

  if (loading) {
    return <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 40 }}>Loading departments…</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedTeam ? '1fr 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
      <SettingsCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Departments</h3>
          <form onSubmit={handleCreateDept} style={{ display: 'flex', gap: 8 }}>
            <SettingsInput value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="New department" style={{ width: 140 }} />
            <PrimaryButton type="submit" disabled={busy}>+ Add</PrimaryButton>
          </form>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#791f1f', background: '#fcebeb', padding: 10, borderRadius: 8, marginBottom: 12 }}>{error}</p>
        )}

        {!hierarchy.departments?.length ? (
          <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 24 }}>No departments yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hierarchy.departments.map((dept) => {
              const teamCount = dept.teams?.length || 0
              const repCount = (dept.teams || []).reduce((n, t) => n + (t.memberCount || t.members?.length || 0), 0)
              const isOpen = expanded[dept.id]
              return (
                <div key={dept.id} style={{ border: `0.5px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f9f9f7' }}>
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [dept.id]: !e[dept.id] }))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, flex: 1, textAlign: 'left' }}
                    >
                      {isOpen ? '▼' : '▶'} {dept.name}{' '}
                      <span style={{ color: C.textMuted, fontWeight: 400 }}>
                        ({teamCount} team{teamCount === 1 ? '' : 's'} · {repCount} rep{repCount === 1 ? '' : 's'})
                      </span>
                    </button>
                    <TextButton onClick={() => deleteDept(dept)} danger style={{ fontSize: 11 }}>Delete</TextButton>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '8px 12px 12px' }}>
                      {(dept.teams || []).map((team) => {
                        const mgr = teamMembers.find((m) => m.userId === team.managerUserId)
                        const count = team.memberCount ?? team.members?.length ?? 0
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => selectTeam(team, dept)}
                            style={{
                              display: 'flex',
                              width: '100%',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 8px 8px 20px',
                              border: 'none',
                              borderBottom: `0.5px solid ${C.border}`,
                              background: selectedTeam?.id === team.id ? '#eeedfe' : 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: 12,
                            }}
                          >
                            <span style={{ flex: 1, color: C.text }}>
                              {team.name}
                              <span style={{ color: C.textMuted, marginLeft: 8 }}>
                                Manager: {mgr?.name || '—'} · {count} rep{count === 1 ? '' : 's'}
                              </span>
                            </span>
                            <span style={{ color: C.accent }}>→</span>
                          </button>
                        )
                      })}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 20 }}>
                        <SettingsInput
                          value={newTeamByDept[dept.id] || ''}
                          onChange={(e) => setNewTeamByDept((prev) => ({ ...prev, [dept.id]: e.target.value }))}
                          placeholder="Team name"
                          style={{ flex: 1 }}
                        />
                        <PrimaryButton
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            const name = (newTeamByDept[dept.id] || '').trim()
                            if (!name) return
                            setBusy(true)
                            try {
                              const data = await api.createOrgTeam({ departmentId: dept.id, name })
                              setHierarchy(data)
                              setNewTeamByDept((prev) => ({ ...prev, [dept.id]: '' }))
                            } catch (err) {
                              setError(err.message)
                            } finally {
                              setBusy(false)
                            }
                          }}
                        >
                          + Team
                        </PrimaryButton>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SettingsCard>

      {selectedTeam && (
        <SettingsCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SettingsInput value={teamDraft.name} onChange={(e) => setTeamDraft((d) => ({ ...d, name: e.target.value }))} />
            <PrimaryButton onClick={saveTeam} disabled={busy}>Save</PrimaryButton>
          </div>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.textSecondary, display: 'block', marginBottom: 4 }}>Department</span>
            <SettingsSelect
              value={teamDraft.departmentId || selectedTeam.departmentId}
              onChange={(e) => setTeamDraft((d) => ({ ...d, departmentId: e.target.value }))}
            >
              {(hierarchy.departments || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </SettingsSelect>
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.textSecondary, display: 'block', marginBottom: 4 }}>Manager</span>
            <SettingsSelect
              value={teamDraft.managerUserId}
              onChange={(e) => setTeamDraft((d) => ({ ...d, managerUserId: e.target.value }))}
            >
              <option value="">No manager</option>
              {teamMembers.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </SettingsSelect>
          </label>

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: C.textSecondary, display: 'block', marginBottom: 4 }}>Description</span>
            <SettingsInput
              value={teamDraft.description}
              onChange={(e) => setTeamDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Optional"
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Members</span>
            {unassigned.length > 0 && (
              <SettingsSelect
                defaultValue=""
                onChange={(e) => { if (e.target.value) addMemberToTeam(e.target.value) }}
                style={{ width: 160, fontSize: 12 }}
              >
                <option value="">+ Add member</option>
                {unassigned.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name}</option>
                ))}
              </SettingsSelect>
            )}
          </div>

          <div style={{ border: `0.5px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '24px 1.5fr 1fr 1fr 1fr', gap: 8, padding: '8px 12px', background: '#f9f9f7', fontSize: 11, color: C.textMuted, textTransform: 'uppercase' }}>
              <span />
              <span>Name</span>
              <span>Role</span>
              <span>Leads owned</span>
              <span>Last active</span>
            </div>
            {(selectedTeam.members || []).length === 0 ? (
              <p style={{ fontSize: 12, color: C.textMuted, padding: 16, margin: 0, textAlign: 'center' }}>No members in this team.</p>
            ) : (
              (selectedTeam.members || []).map((m) => (
                <div key={m.userId} style={{ display: 'grid', gridTemplateColumns: '24px 1.5fr 1fr 1fr 1fr', gap: 8, padding: '10px 12px', borderTop: `0.5px solid ${C.border}`, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: C.textMuted, cursor: 'grab' }}>⋮⋮</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#e1f5ee', color: '#085041', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {memberInitials(m.name, m.email)}
                    </span>
                    <span>{m.name}</span>
                  </div>
                  <span style={{ color: C.textSecondary }}>{m.role || 'rep'}</span>
                  <span style={{ color: C.textSecondary }}>{m.openLeadCount ?? '—'}</span>
                  <span style={{ color: C.textMuted }}>—</span>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <TextButton danger onClick={() => deleteTeam(selectedTeam)}>Delete team</TextButton>
          </div>
        </SettingsCard>
      )}
    </div>
  )
}
