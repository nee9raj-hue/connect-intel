import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import {
  AVATAR_BY_ROLE,
  C,
  ROLE_BADGE,
  STATUS_BADGE,
  inviteDomainFromUser,
  memberInitials,
  normalizeMemberRole,
  normalizeMemberStatus,
} from './settingsTheme'
import { SettingsBadge, SettingsCard, SettingsInput, SettingsSelect, SettingsStatCard, TextButton } from './SettingsUi'

const PAGE_SIZE = 25

function buildTeamMap(departments) {
  const map = new Map()
  for (const d of departments || []) {
    for (const t of d.teams || []) {
      map.set(t.id, `${d.name} — ${t.name}`)
    }
  }
  return map
}

function MemberActionsMenu({ member, onAction, busy }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const isInvited = normalizeMemberStatus(member.status) === 'invited'
  const isAdmin = member.role === 'org_admin'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Member actions"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        style={{
          width: 32,
          height: 32,
          border: `0.5px solid ${C.border}`,
          borderRadius: 6,
          background: '#fff',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ···
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 4,
            minWidth: 180,
            background: '#fff',
            border: `0.5px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            zIndex: 20,
            padding: 4,
          }}
        >
          {!isAdmin && (
            <>
              <MenuItem label="Change role" onClick={() => { onAction('role', member); setOpen(false) }} />
              <MenuItem label="Reassign team" onClick={() => { onAction('team', member); setOpen(false) }} />
              {isInvited && <MenuItem label="Resend invite" onClick={() => { onAction('resend', member); setOpen(false) }} />}
              <MenuItem
                label={normalizeMemberStatus(member.status) === 'suspended' ? 'Reactivate' : 'Deactivate'}
                onClick={() => { onAction('toggleStatus', member); setOpen(false) }}
              />
              <MenuItem label="Remove from org" danger onClick={() => { onAction('remove', member); setOpen(false) }} />
            </>
          )}
          {isAdmin && <MenuItem label="Org admin (locked)" disabled />}
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, onClick, danger, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 500,
        border: 'none',
        borderRadius: 6,
        background: 'transparent',
        color: danger ? '#791f1f' : C.text,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )
}

export default function TeamMembersTab({
  user,
  teamMembers,
  orgLeadTags,
  teamMap = new Map(),
  teamOptions = [],
  refreshTeam,
  updateMemberPermissions,
  onInviteClick,
  onNavigateTab,
  onNotice,
}) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState(null)
  const [roleModal, setRoleModal] = useState(null)
  const [teamModal, setTeamModal] = useState(null)
  const stats = useMemo(() => {
    let admins = 0
    let managers = 0
    for (const m of teamMembers) {
      const r = normalizeMemberRole(m)
      if (r === 'admin' || m.role === 'org_admin') admins += 1
      else if (r === 'manager' || r === 'marketing_manager') managers += 1
    }
    return { admins, managers }
  }, [teamMembers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teamMembers.filter((m) => {
      const role = normalizeMemberRole(m)
      const status = normalizeMemberStatus(m.status)
      if (roleFilter !== 'all' && role !== roleFilter && !(roleFilter === 'admin' && m.role === 'org_admin')) {
        return false
      }
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (!q) return true
      return (
        String(m.name || '').toLowerCase().includes(q) ||
        String(m.email || '').toLowerCase().includes(q)
      )
    })
  }, [teamMembers, search, roleFilter, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageMembers = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const handleAction = async (action, member) => {
    if (action === 'role') {
      setRoleModal(member)
      return
    }
    if (action === 'team') {
      setTeamModal(member)
      return
    }
    if (action === 'toggleStatus' || action === 'remove') {
      const next = member.status === 'inactive' ? 'active' : 'inactive'
      const label = action === 'remove' ? 'remove from the organization' : next === 'inactive' ? 'deactivate' : 'reactivate'
      if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${member.name}?`)) return
      setBusyId(member.userId)
      try {
        await updateMemberPermissions({ userId: member.userId, status: next === 'inactive' ? 'inactive' : 'active' })
        await refreshTeam()
      } finally {
        setBusyId(null)
      }
      return
    }
    if (action === 'resend') {
      setBusyId(member.userId)
      try {
        await api.inviteTeamMember({ email: member.email, pipelineRole: member.pipelineRole || 'member' })
      } finally {
        setBusyId(null)
      }
    }
  }

  const applyRole = async (member, roleKey) => {
    setBusyId(member.userId)
    const payload = {
      userId: member.userId,
      teamId: member.teamId,
      departmentId: member.departmentId,
    }
    if (roleKey === 'manager') {
      payload.sqlRole = 'manager'
      payload.pipelineRole = 'manager'
    } else if (roleKey === 'marketing_manager') {
      payload.sqlRole = 'manager'
      payload.marketingRole = 'manager'
    } else if (roleKey === 'marketing_executive') {
      payload.sqlRole = 'rep'
      payload.marketingRole = 'executive'
    } else {
      payload.sqlRole = 'rep'
      payload.pipelineRole = 'member'
    }
    try {
      await updateMemberPermissions(payload)
      await refreshTeam()
      onNotice?.(`Role updated for ${member.name}`)
      setRoleModal(null)
    } catch (err) {
      onNotice?.(err.message || 'Could not update role', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const applyTeam = async (member, teamKey) => {
    if (!teamKey) return
    const [teamId, departmentId] = teamKey.split('|')
    setBusyId(member.userId)
    try {
      await updateMemberPermissions({
        userId: member.userId,
        sqlRole: member.sqlRole || 'rep',
        teamId,
        departmentId,
      })
      await refreshTeam()
      onNotice?.(`Team updated for ${member.name}`)
      setTeamModal(null)
    } catch (err) {
      onNotice?.(err.message || 'Could not assign team', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Team', 'Role', 'Status']
    const rows = filtered.map((m) => [
      m.name,
      m.email,
      teamMap.get(m.teamId) || '—',
      ROLE_BADGE[normalizeMemberRole(m)]?.label || normalizeMemberRole(m),
      STATUS_BADGE[normalizeMemberStatus(m.status)]?.label || m.status,
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'team-members.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const domain = inviteDomainFromUser(user)
  const searchesUsed = user?.searchesUsed ?? Math.max(0, (user?.searchesTotal ?? 100) - (user?.searchesLeft ?? 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <SettingsStatCard
          label="Total members"
          value={teamMembers.length}
          subtitle={`${stats.admins} admin · ${stats.managers} manager${stats.managers === 1 ? '' : 's'}`}
        />
        <SettingsStatCard
          label="AI searches used"
          value={searchesUsed}
          subtitle="Remaining in pool"
        />
        <SettingsStatCard
          label="Lead tags"
          value={orgLeadTags?.length ?? 0}
          subtitle="For pipeline segments"
        />
        <SettingsStatCard
          label="Invite domain"
          value={<span style={{ fontSize: 13 }}>{domain}</span>}
          subtitle="Auto-join enabled"
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <SettingsInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search by name or email…"
          style={{ flex: '1 1 200px' }}
        />
        <SettingsSelect value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0) }} style={{ minWidth: 120 }}>
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="rep">Rep</option>
          <option value="marketing_manager">Marketing manager</option>
          <option value="marketing_executive">Marketing executive</option>
        </SettingsSelect>
        <SettingsSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }} style={{ minWidth: 120 }}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="suspended">Suspended</option>
        </SettingsSelect>
        <TextButton onClick={exportCsv} style={{ marginLeft: 'auto' }}>Export CSV</TextButton>
      </div>

      <SettingsCard style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 80px',
            gap: 8,
            padding: '11px 16px',
            background: '#f9f9f7',
            borderBottom: `0.5px solid ${C.border}`,
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: C.textMuted,
          }}
        >
          <span>Member</span>
          <span>Team</span>
          <span>Role</span>
          <span>Status</span>
          <span />
        </div>

        {pageMembers.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: C.textSecondary, margin: '0 0 8px' }}>No team members yet.</p>
            <TextButton onClick={onInviteClick}>Invite your first teammate →</TextButton>
          </div>
        ) : (
          pageMembers.map((m) => {
            const roleKey = normalizeMemberRole(m)
            const statusKey = normalizeMemberStatus(m.status)
            const roleStyle = ROLE_BADGE[roleKey] || ROLE_BADGE.rep
            const statusStyle = STATUS_BADGE[statusKey] || STATUS_BADGE.active
            const avatar = AVATAR_BY_ROLE[roleKey] || AVATAR_BY_ROLE.rep
            return (
              <div
                key={m.userId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 80px',
                  gap: 8,
                  alignItems: 'center',
                  padding: '11px 16px',
                  borderBottom: `0.5px solid ${C.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: avatar.bg,
                      color: avatar.color,
                      fontSize: 11,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {memberInitials(m.name, m.email)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </p>
                    <p style={{ fontSize: 11, margin: 0, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.email}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: C.textSecondary }}>
                  {teamMap.get(m.teamId) || (
                    <button type="button" onClick={() => onNavigateTab?.('teams')} style={{ fontSize: 12, color: C.accent, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                      Assign team
                    </button>
                  )}
                </span>
                <SettingsBadge bg={roleStyle.bg} color={roleStyle.color}>{roleStyle.label}</SettingsBadge>
                <SettingsBadge bg={statusStyle.bg} color={statusStyle.color}>{statusStyle.label}</SettingsBadge>
                <MemberActionsMenu member={m} onAction={handleAction} busy={busyId === m.userId} />
              </div>
            )
          })
        )}

        {filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', fontSize: 12, color: C.textSecondary }}>
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <TextButton disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</TextButton>
              <TextButton disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</TextButton>
            </div>
          </div>
        )}
      </SettingsCard>

      {roleModal && (
        <Modal title={`Change role — ${roleModal.name}`} onClose={() => setRoleModal(null)}>
          <SettingsSelect
            value={normalizeMemberRole(roleModal)}
            onChange={(e) => applyRole(roleModal, e.target.value)}
          >
            <option value="rep">Rep</option>
            <option value="manager">Manager</option>
            <option value="marketing_executive">Marketing executive</option>
            <option value="marketing_manager">Marketing manager</option>
          </SettingsSelect>
        </Modal>
      )}

      {teamModal && (
        <Modal title={`Reassign team — ${teamModal.name}`} onClose={() => setTeamModal(null)}>
          <SettingsSelect
            defaultValue={teamModal.teamId ? `${teamModal.teamId}|${teamModal.departmentId || ''}` : ''}
            onChange={(e) => applyTeam(teamModal, e.target.value)}
          >
            <option value="">Select team…</option>
            {teamOptions.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </SettingsSelect>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <>
      <button type="button" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.35)', border: 'none' }} />
      <div style={{ position: 'fixed', left: '50%', top: '40%', transform: 'translate(-50%,-50%)', zIndex: 41, background: '#fff', borderRadius: 12, padding: 20, minWidth: 320, border: `0.5px solid ${C.border}` }}>
        <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 12px' }}>{title}</p>
        {children}
      </div>
    </>
  )
}
