import { useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { C, memberInitials } from './settingsTheme'
import HierarchySetupBanner from './HierarchySetupBanner'
import { PrimaryButton, SettingsCard, SettingsInput, SettingsSelect, TextButton } from './SettingsUi'

export default function TeamsDepartmentsTab({
  hierarchy,
  loading,
  error,
  sql,
  teamMembers,
  onRefresh,
  onHierarchyChange,
  updateMemberPermissions,
  onMembersChanged,
  onNotice,
}) {
  const [expanded, setExpanded] = useState({})
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [deptName, setDeptName] = useState('')
  const [teamDraft, setTeamDraft] = useState({ name: '', managerUserId: '', description: '' })
  const [newTeamByDept, setNewTeamByDept] = useState({})
  const [busy, setBusy] = useState(null)

  const departments = hierarchy?.departments || []

  const flatTeams = useMemo(() => {
    const list = []
    for (const d of departments) {
      for (const t of d.teams || []) {
        list.push({ ...t, departmentId: d.id, departmentName: d.name })
      }
    }
    return list
  }, [departments])

  const selectedTeamFresh = useMemo(() => {
    if (!selectedTeam) return null
    return flatTeams.find((t) => t.id === selectedTeam.id) || selectedTeam
  }, [flatTeams, selectedTeam])

  const applyHierarchy = (data) => {
    onHierarchyChange?.(data)
    const exp = { ...expanded }
    for (const d of data.departments || []) exp[d.id] = true
    setExpanded(exp)
  }

  const handleCreateDept = async (e) => {
    e.preventDefault()
    const name = deptName.trim()
    if (!name) return
    setBusy('dept')
    try {
      const data = await api.createOrgDepartment({ name })
      applyHierarchy(data)
      setDeptName('')
      onNotice?.('Department created')
    } catch (err) {
      onNotice?.(err.message || 'Could not create department', 'error')
    } finally {
      setBusy(null)
    }
  }

  const saveTeam = async () => {
    if (!selectedTeamFresh) return
    setBusy('save-team')
    try {
      const data = await api.updateOrgTeam({
        id: selectedTeamFresh.id,
        name: teamDraft.name || selectedTeamFresh.name,
        managerUserId: teamDraft.managerUserId || null,
        departmentId: teamDraft.departmentId || selectedTeamFresh.departmentId,
      })
      applyHierarchy(data)
      onNotice?.('Team saved')
      onMembersChanged?.()
    } catch (err) {
      onNotice?.(err.message || 'Could not save team', 'error')
    } finally {
      setBusy(null)
    }
  }

  const selectTeam = (team, dept) => {
    setSelectedTeam({ ...team, departmentId: dept.id, departmentName: dept.name })
    setTeamDraft({
      name: team.name,
      managerUserId: team.managerUserId || team.managerLegacyUserId || '',
      departmentId: dept.id,
      description: team.description || '',
    })
    setExpanded((prev) => ({ ...prev, [dept.id]: true }))
  }

  const addMemberToTeam = async (userId) => {
    if (!selectedTeamFresh) return
    const member = teamMembers.find((m) => m.userId === userId)
    setBusy(`add-${userId}`)
    try {
      await updateMemberPermissions({
        userId,
        sqlRole: member?.sqlRole || 'rep',
        teamId: selectedTeamFresh.id,
        departmentId: selectedTeamFresh.departmentId,
      })
      const data = await api.getOrgHierarchy({ skipLeadCounts: true, silent: true })
      applyHierarchy(data)
      onMembersChanged?.()
      onNotice?.(`${member?.name || 'Member'} added to team`)
    } catch (err) {
      onNotice?.(err.message || 'Could not assign member', 'error')
    } finally {
      setBusy(null)
    }
  }

  const deleteDept = async (dept) => {
    if (!window.confirm(`Delete department "${dept.name}"?`)) return
    setBusy(`del-dept-${dept.id}`)
    try {
      const data = await api.deleteOrgDepartment(dept.id)
      applyHierarchy(data)
      if (selectedTeam?.departmentId === dept.id) setSelectedTeam(null)
      onNotice?.('Department deleted')
    } catch (err) {
      onNotice?.(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const deleteTeam = async (team) => {
    if (!window.confirm(`Delete team "${team.name}"?`)) return
    setBusy(`del-team-${team.id}`)
    try {
      const data = await api.deleteOrgTeam(team.id)
      applyHierarchy(data)
      if (selectedTeam?.id === team.id) setSelectedTeam(null)
      onNotice?.('Team deleted')
    } catch (err) {
      onNotice?.(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const membersToAdd = useMemo(() => {
    if (!selectedTeamFresh) return []
    const inTeam = new Set((selectedTeamFresh.members || []).map((m) => m.userId))
    return teamMembers.filter((m) => m.role !== 'org_admin' && !inTeam.has(m.userId))
  }, [selectedTeamFresh, teamMembers])

  if (loading && !departments.length) {
    return <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 40 }}>Loading departments…</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HierarchySetupBanner error={error} sql={sql} />

      <div style={{ display: 'grid', gridTemplateColumns: selectedTeamFresh ? '1fr 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
        <SettingsCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Departments</h3>
            <form onSubmit={handleCreateDept} style={{ display: 'flex', gap: 8, flex: '1 1 220px', justifyContent: 'flex-end' }}>
              <SettingsInput
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="New department name"
                style={{ flex: 1, minWidth: 140, maxWidth: 200 }}
              />
              <PrimaryButton type="submit" disabled={Boolean(busy) || !deptName.trim()}>
                + Add department
              </PrimaryButton>
            </form>
          </div>

          {!departments.length ? (
            <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 24 }}>
              No departments yet. Enter a name above and click <strong>+ Add department</strong>.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {departments.map((dept) => {
                const teamCount = dept.teams?.length || 0
                const repCount = (dept.teams || []).reduce((n, t) => n + (t.memberCount || t.members?.length || 0), 0)
                const isOpen = expanded[dept.id] !== false
                return (
                  <div key={dept.id} style={{ border: `0.5px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f9f9f7' }}>
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [dept.id]: !isOpen }))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, flex: 1, textAlign: 'left' }}
                      >
                        {isOpen ? '▼' : '▶'} {dept.name}{' '}
                        <span style={{ color: C.textMuted, fontWeight: 400 }}>
                          ({teamCount} team{teamCount === 1 ? '' : 's'} · {repCount} rep{repCount === 1 ? '' : 's'})
                        </span>
                      </button>
                      <TextButton onClick={() => deleteDept(dept)} danger style={{ fontSize: 11 }} disabled={Boolean(busy)}>
                        Delete
                      </TextButton>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '8px 12px 12px' }}>
                        {(dept.teams || []).map((team) => {
                          const mgrId = team.managerUserId || team.managerLegacyUserId
                          const mgr = teamMembers.find((m) => m.userId === mgrId)
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
                                background: selectedTeamFresh?.id === team.id ? '#eeedfe' : 'transparent',
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.target.nextElementSibling?.click()
                              }
                            }}
                          />
                          <PrimaryButton
                            type="button"
                            disabled={Boolean(busy) || !(newTeamByDept[dept.id] || '').trim()}
                            onClick={async () => {
                              const name = (newTeamByDept[dept.id] || '').trim()
                              if (!name) return
                              setBusy(`team-${dept.id}`)
                              try {
                                const data = await api.createOrgTeam({ departmentId: dept.id, name })
                                applyHierarchy(data)
                                setNewTeamByDept((prev) => ({ ...prev, [dept.id]: '' }))
                                onNotice?.('Team created')
                              } catch (err) {
                                onNotice?.(err.message, 'error')
                              } finally {
                                setBusy(null)
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

        {selectedTeamFresh && (
          <SettingsCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
              <SettingsInput value={teamDraft.name} onChange={(e) => setTeamDraft((d) => ({ ...d, name: e.target.value }))} />
              <PrimaryButton onClick={saveTeam} disabled={busy === 'save-team'}>Save</PrimaryButton>
            </div>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: C.textSecondary, display: 'block', marginBottom: 4 }}>Department</span>
              <SettingsSelect
                value={teamDraft.departmentId || selectedTeamFresh.departmentId}
                onChange={(e) => setTeamDraft((d) => ({ ...d, departmentId: e.target.value }))}
              >
                {departments.map((d) => (
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Members</span>
              {membersToAdd.length > 0 ? (
                <SettingsSelect
                  value=""
                  onChange={(e) => { if (e.target.value) addMemberToTeam(e.target.value) }}
                  style={{ width: 180, fontSize: 12 }}
                  disabled={Boolean(busy)}
                >
                  <option value="">+ Add member</option>
                  {membersToAdd.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </SettingsSelect>
              ) : (
                <span style={{ fontSize: 11, color: C.textMuted }}>All members assigned</span>
              )}
            </div>

            <div style={{ border: `0.5px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '24px 1.5fr 1fr 1fr', gap: 8, padding: '8px 12px', background: '#f9f9f7', fontSize: 11, color: C.textMuted, textTransform: 'uppercase' }}>
                <span />
                <span>Name</span>
                <span>Role</span>
                <span>Leads owned</span>
              </div>
              {(selectedTeamFresh.members || []).length === 0 ? (
                <p style={{ fontSize: 12, color: C.textMuted, padding: 16, margin: 0, textAlign: 'center' }}>
                  No members yet — use <strong>+ Add member</strong> above.
                </p>
              ) : (
                (selectedTeamFresh.members || []).map((m) => (
                  <div key={m.userId} style={{ display: 'grid', gridTemplateColumns: '24px 1.5fr 1fr 1fr', gap: 8, padding: '10px 12px', borderTop: `0.5px solid ${C.border}`, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: C.textMuted }}>⋮⋮</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#e1f5ee', color: '#085041', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {memberInitials(m.name, m.email)}
                      </span>
                      <span>{m.name}</span>
                    </div>
                    <span style={{ color: C.textSecondary }}>{m.role || 'rep'}</span>
                    <span style={{ color: C.textSecondary }}>{m.openLeadCount ?? '—'}</span>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              <TextButton danger onClick={() => deleteTeam(selectedTeamFresh)} disabled={Boolean(busy)}>
                Delete team
              </TextButton>
              <TextButton onClick={() => onRefresh?.()} disabled={Boolean(busy)}>Refresh</TextButton>
            </div>
          </SettingsCard>
        )}
      </div>
    </div>
  )
}
