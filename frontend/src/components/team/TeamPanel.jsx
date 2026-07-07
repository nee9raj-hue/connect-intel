import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import {
  C,
  getVisibleSettingsTabs,
  normalizeSettingsTab,
} from './settings/settingsTheme'
import { PrimaryButton, Toast } from './settings/SettingsUi'
import InviteMemberDrawer from './settings/InviteMemberDrawer'
import TeamMembersTab from './settings/TeamMembersTab'
import TeamsDepartmentsTab from './settings/TeamsDepartmentsTab'
import PermissionsTab from './settings/PermissionsTab'
import AuditLogTab from './settings/AuditLogTab'
import EmailSendsTab from './settings/EmailSendsTab'
import IntegrationsTab from './settings/IntegrationsTab'
import ImportLeadsTab from './settings/ImportLeadsTab'
import BillingTab from './settings/BillingTab'

function buildTeamMap(departments) {
  const map = new Map()
  for (const d of departments || []) {
    for (const t of d.teams || []) {
      map.set(t.id, `${d.name} — ${t.name}`)
    }
  }
  return map
}

function buildTeamOptions(departments) {
  return (departments || []).flatMap((d) =>
    (d.teams || []).map((t) => ({
      key: `${t.id}|${d.id}`,
      label: `${d.name} → ${t.name}`,
    }))
  )
}

export default function TeamPanel({ onNavigate, panelOptions = {} }) {
  const activeTab = normalizeSettingsTab(panelOptions.teamTab)
  const {
    user,
    teamMembers,
    orgLeadTags,
    refreshTeam,
    refreshSavedLeads,
    inviteTeamMember,
    updateMemberPermissions,
  } = useApp()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [hierarchy, setHierarchy] = useState({ departments: [], sql: true })
  const [hierarchyLoading, setHierarchyLoading] = useState(false)
  const [hierarchyError, setHierarchyError] = useState(null)
  const hierarchyLoadedRef = useRef(false)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const loadHierarchy = useCallback(async ({ force = false, silent = true } = {}) => {
    if (hierarchyLoadedRef.current && !force && hierarchy.departments?.length) return hierarchy
    setHierarchyLoading(true)
    setHierarchyError(null)
    try {
      const data = await api.getOrgHierarchy({ skipLeadCounts: true, silent })
      setHierarchy(data)
      hierarchyLoadedRef.current = true
      if (data.sql === false) {
        setHierarchyError('SQL hierarchy is not enabled for this workspace.')
      }
      return data
    } catch (err) {
      setHierarchyError(err.message || 'Could not load departments')
      throw err
    } finally {
      setHierarchyLoading(false)
    }
  }, [hierarchy.departments?.length])

  useEffect(() => {
    if (!user?.isOrgAdmin || user?.accountType !== 'company') return
    api.getTeamMembers({ silent: true }).then((data) => {
      if (data?.members?.length) return
      refreshTeam({ force: true })
    }).catch(() => refreshTeam({ force: true }))
  }, [user?.isOrgAdmin, user?.accountType, refreshTeam])

  useEffect(() => {
    if (!user?.isOrgAdmin || user?.accountType !== 'company') return
    if (activeTab === 'members' || activeTab === 'teams') {
      loadHierarchy()
    }
  }, [activeTab, user?.isOrgAdmin, user?.accountType, loadHierarchy])

  const teamMap = useMemo(() => buildTeamMap(hierarchy.departments), [hierarchy.departments])
  const teamOptions = useMemo(() => buildTeamOptions(hierarchy.departments), [hierarchy.departments])

  const setTab = (tab) => {
    onNavigate?.('team', { teamTab: tab }, { replace: true })
  }

  if (user?.isPlatformAdmin) {
    return (
      <div className="panel-shell flex items-center justify-center p-8">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-lg font-medium text-gray-900">Platform operator</h2>
          <p className="mt-2 text-sm text-gray-500">
            Customer team settings live in their workspaces. Use Platform backend for account operations.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('admin-home')}
            className="mt-5 px-4 py-2.5 text-sm font-medium rounded-lg text-white"
            style={{ background: C.accent }}
          >
            Platform backend
          </button>
        </div>
      </div>
    )
  }

  if (!user?.isOrgAdmin || user?.accountType !== 'company') {
    return (
      <div className="panel-shell flex items-center justify-center p-8">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-lg font-medium text-gray-900">Work email</h2>
          <p className="mt-2 text-sm text-gray-500">
            Team administration is for company admins. Connect your Gmail to send from Pipeline.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('my-email')}
            className="mt-5 px-4 py-2.5 text-sm font-medium rounded-lg text-white"
            style={{ background: C.accent }}
          >
            Open Work email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel-shell" style={{ background: C.pageBg }}>
      <header
        className="shrink-0 sticky top-0 z-20"
        style={{ background: '#fff', borderBottom: `0.5px solid ${C.border}` }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 24px',
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0, color: C.text }}>Settings</h1>
            <p style={{ fontSize: 12, color: C.textSecondary, margin: '4px 0 0' }}>
              Manage your team, permissions, and workspace configuration
            </p>
          </div>
          <PrimaryButton onClick={() => setInviteOpen(true)}>Invite member</PrimaryButton>
        </div>

        <nav
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            padding: '0 24px',
            maxWidth: 1200,
            margin: '0 auto',
            borderTop: `0.5px solid ${C.border}`,
          }}
        >
          {getVisibleSettingsTabs().map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                style={{
                  flexShrink: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                  background: 'transparent',
                  color: isActive ? C.accent : C.textSecondary,
                  cursor: 'pointer',
                  marginBottom: -1,
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </header>

      <div className="panel-body-scroll">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
          {activeTab === 'members' && (
            <TeamMembersTab
              user={user}
              teamMembers={teamMembers}
              orgLeadTags={orgLeadTags}
              teamMap={teamMap}
              teamOptions={teamOptions}
              refreshTeam={refreshTeam}
              updateMemberPermissions={updateMemberPermissions}
              onInviteClick={() => setInviteOpen(true)}
              onNavigateTab={setTab}
              onNotice={showToast}
            />
          )}
          {activeTab === 'teams' && (
            <TeamsDepartmentsTab
              hierarchy={hierarchy}
              loading={hierarchyLoading}
              error={hierarchyError}
              sql={hierarchy.sql}
              teamMembers={teamMembers}
              onRefresh={() => loadHierarchy({ force: true })}
              onHierarchyChange={setHierarchy}
              updateMemberPermissions={updateMemberPermissions}
              onMembersChanged={async () => {
                await refreshTeam({ force: true })
                await loadHierarchy({ force: true })
              }}
              onNotice={showToast}
            />
          )}
          {activeTab === 'permissions' && (
            <PermissionsTab teamMembers={teamMembers} />
          )}
          {activeTab === 'audit' && (
            <AuditLogTab teamMembers={teamMembers} />
          )}
          {activeTab === 'email-sends' && <EmailSendsTab />}
          {activeTab === 'integrations' && (
            <IntegrationsTab onNavigate={onNavigate} />
          )}
          {activeTab === 'import' && (
            <ImportLeadsTab
              onImported={async () => {
                await refreshSavedLeads()
                showToast('Import complete')
              }}
              onNavigate={onNavigate}
            />
          )}
          {activeTab === 'billing' && <BillingTab />}
        </div>
      </div>

      <InviteMemberDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        user={user}
        teamOptions={teamOptions}
        inviteTeamMember={inviteTeamMember}
        updateMemberPermissions={updateMemberPermissions}
        onSuccess={async () => {
          await refreshTeam()
          await loadHierarchy({ force: true })
          showToast('Invite sent successfully')
        }}
      />

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  )
}
