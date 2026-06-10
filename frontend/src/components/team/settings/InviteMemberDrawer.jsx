import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { C, inviteDomainFromUser } from './settingsTheme'
import { PrimaryButton, SettingsInput, SettingsSelect } from './SettingsUi'

const INVITE_ROLES = [
  { id: 'rep', sqlRole: 'rep', pipelineRole: 'member', label: 'Rep' },
  { id: 'manager', sqlRole: 'manager', pipelineRole: 'manager', label: 'Manager' },
  { id: 'marketing_executive', sqlRole: 'rep', marketingRole: 'executive', label: 'Marketing executive' },
  { id: 'marketing_manager', sqlRole: 'manager', marketingRole: 'manager', label: 'Marketing manager' },
]

export default function InviteMemberDrawer({ open, onClose, user, inviteTeamMember, onSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('rep')
  const [teamKey, setTeamKey] = useState('')
  const [allowExternal, setAllowExternal] = useState(false)
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const domain = inviteDomainFromUser(user)

  useEffect(() => {
    if (!open) return
    api.getOrgHierarchy().then((data) => {
      const opts = (data?.departments || []).flatMap((d) =>
        (d.teams || []).map((t) => ({
          key: `${t.id}|${d.id}`,
          label: `${d.name} → ${t.name}`,
        }))
      )
      setTeams(opts)
    }).catch(() => setTeams([]))
  }, [open])

  const role = useMemo(() => INVITE_ROLES.find((r) => r.id === roleId) || INVITE_ROLES[0], [roleId])

  const emailDomainOk = useMemo(() => {
    const e = email.trim().toLowerCase()
    if (!e.includes('@')) return false
    return e.endsWith(`@${domain.toLowerCase()}`)
  }, [email, domain])

  const canSubmit = email.trim() && (allowExternal || emailDomainOk) && !loading

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const data = await inviteTeamMember({
        email: email.trim(),
        name: name.trim() || undefined,
        canSearch: false,
        pipelineRole: role.pipelineRole,
        marketingRole: role.marketingRole,
      })
      if (teamKey) {
        const [teamId, departmentId] = teamKey.split('|')
        const members = data?.members || (await api.getTeamMembers()).members
        const invited = members.find((m) => m.email?.toLowerCase() === email.trim().toLowerCase())
        if (invited?.userId) {
          await api.updateMemberPermissions({
            userId: invited.userId,
            sqlRole: role.sqlRole,
            teamId,
            departmentId,
            marketingRole: role.marketingRole,
          })
        }
      }
      onSuccess?.(data)
      setName('')
      setEmail('')
      setTeamKey('')
      setAllowExternal(false)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Invite failed')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close invite drawer"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(0,0,0,0.4)',
          border: 'none',
          cursor: 'pointer',
        }}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(400px, 100vw)',
          zIndex: 51,
          background: '#fff',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 20px 12px', borderBottom: `0.5px solid ${C.border}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0, color: C.text }}>Invite member</h2>
          <p style={{ fontSize: 12, color: C.textSecondary, margin: '4px 0 0' }}>
            They will receive an email with a sign-in link.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <p style={{ fontSize: 12, color: '#791f1f', background: '#fcebeb', padding: '10px 12px', borderRadius: 8, margin: 0 }}>
              {error}
            </p>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.textSecondary }}>Full name</span>
            <SettingsInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Sharma" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.textSecondary }}>Work email</span>
            <SettingsInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`name@${domain}`}
              required
            />
          </label>
          {!emailDomainOk && email.includes('@') && !allowExternal && (
            <p style={{ fontSize: 12, color: '#633806', margin: 0 }}>
              Email should use @{domain} or enable external invite below.
            </p>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textSecondary, cursor: 'pointer' }}>
            <input type="checkbox" checked={allowExternal} onChange={(e) => setAllowExternal(e.target.checked)} />
            Send to external email
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.textSecondary }}>Role</span>
            <SettingsSelect value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {INVITE_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </SettingsSelect>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.textSecondary }}>Team</span>
            <SettingsSelect value={teamKey} onChange={(e) => setTeamKey(e.target.value)}>
              <option value="">No team yet</option>
              {teams.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </SettingsSelect>
          </label>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 10, paddingTop: 16 }}>
            <PrimaryButton type="submit" disabled={!canSubmit} style={{ flex: 1 }}>
              {loading ? 'Sending…' : 'Send invite'}
            </PrimaryButton>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: 13,
                fontWeight: 500,
                padding: '9px 16px',
                borderRadius: 8,
                border: `0.5px solid ${C.border}`,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
