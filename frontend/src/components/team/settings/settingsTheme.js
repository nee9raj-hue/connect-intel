/** Shared tokens for Org Admin / Settings hub (HubSpot-style). */

export const C = {
  pageBg: '#f5f5f3',
  cardBg: '#ffffff',
  border: 'rgba(0, 0, 0, 0.08)',
  accent: '#3730a3',
  text: '#111111',
  textSecondary: '#666666',
  textMuted: '#999999',
}

export const ROLE_BADGE = {
  admin: { bg: '#eeedfe', color: '#3c3489', label: 'Admin' },
  org_admin: { bg: '#eeedfe', color: '#3c3489', label: 'Admin' },
  manager: { bg: '#e6f1fb', color: '#0c447c', label: 'Manager' },
  marketing_manager: { bg: '#e6f1fb', color: '#0c447c', label: 'Marketing manager' },
  rep: { bg: '#e1f5ee', color: '#085041', label: 'Rep' },
  member: { bg: '#e1f5ee', color: '#085041', label: 'Rep' },
  marketing_executive: { bg: '#e1f5ee', color: '#085041', label: 'Marketing executive' },
}

export const STATUS_BADGE = {
  active: { bg: '#eaf3de', color: '#27500a', label: 'Active' },
  invited: { bg: '#faeeda', color: '#633806', label: 'Invited' },
  pending: { bg: '#faeeda', color: '#633806', label: 'Invited' },
  suspended: { bg: '#fcebeb', color: '#791f1f', label: 'Suspended' },
  inactive: { bg: '#fcebeb', color: '#791f1f', label: 'Suspended' },
}

export const AVATAR_BY_ROLE = {
  admin: { bg: '#e6f1fb', color: '#0c447c' },
  org_admin: { bg: '#e6f1fb', color: '#0c447c' },
  manager: { bg: '#eeedfe', color: '#3c3489' },
  marketing_manager: { bg: '#eeedfe', color: '#3c3489' },
  rep: { bg: '#e1f5ee', color: '#085041' },
  member: { bg: '#e1f5ee', color: '#085041' },
  marketing_executive: { bg: '#e1f5ee', color: '#085041' },
}

export function memberInitials(name, email) {
  const n = String(name || '').trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return n.slice(0, 2).toUpperCase()
  }
  return String(email || '?').slice(0, 2).toUpperCase()
}

export function normalizeMemberRole(member) {
  if (member?.role === 'org_admin') return 'admin'
  const sql = member?.sqlRole
  if (sql === 'admin' || sql === 'manager' || sql === 'rep') return sql
  if (member?.marketingRole === 'manager') return 'marketing_manager'
  if (member?.marketingRole === 'executive') return 'marketing_executive'
  if (member?.pipelineRole === 'manager') return 'manager'
  return 'rep'
}

export function normalizeMemberStatus(status) {
  if (status === 'pending') return 'invited'
  if (status === 'inactive') return 'suspended'
  return status || 'active'
}

export function inviteDomainFromUser(user) {
  const email = String(user?.email || '')
  const at = email.indexOf('@')
  if (at > 0) return email.slice(at + 1)
  return user?.organizationName ? `${String(user.organizationName).toLowerCase().replace(/\s+/g, '')}.com` : '—'
}

export const SETTINGS_TABS = [
  { id: 'members', label: 'Team members' },
  { id: 'teams', label: 'Teams & departments' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'import', label: 'Import leads' },
  { id: 'billing', label: 'Billing' },
]

export function normalizeSettingsTab(tab) {
  if (!tab || tab === 'team') return 'members'
  if (tab === 'hierarchy') return 'teams'
  return tab
}
