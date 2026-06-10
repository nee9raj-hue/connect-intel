import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  C,
  SETTINGS_TABS,
  normalizeSettingsTab,
} from './settings/settingsTheme'
import { PrimaryButton, Toast } from './settings/SettingsUi'
import InviteMemberDrawer from './settings/InviteMemberDrawer'
import TeamMembersTab from './settings/TeamMembersTab'
import TeamsDepartmentsTab from './settings/TeamsDepartmentsTab'
import PermissionsTab from './settings/PermissionsTab'
import IntegrationsTab from './settings/IntegrationsTab'
import ImportLeadsTab from './settings/ImportLeadsTab'
import BillingTab from './settings/BillingTab'

export default function TeamPanel({ onNavigate, panelOptions = {} }) {
  const activeTab = normalizeSettingsTab(panelOptions.teamTab)
  const {
    user,
    teamMembers,
    orgLeadTags,
    refreshTeam,
    refreshSavedLeads,
    refreshOrgLeadTags,
    inviteTeamMember,
    updateMemberPermissions,
  } = useApp()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    refreshTeam()
    refreshOrgLeadTags?.()
  }, [refreshTeam, refreshOrgLeadTags])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

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
          {SETTINGS_TABS.map((tab) => {
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
              refreshTeam={refreshTeam}
              updateMemberPermissions={updateMemberPermissions}
              onInviteClick={() => setInviteOpen(true)}
              onNavigateTab={setTab}
            />
          )}
          {activeTab === 'teams' && (
            <TeamsDepartmentsTab teamMembers={teamMembers} onMembersChanged={refreshTeam} />
          )}
          {activeTab === 'permissions' && (
            <PermissionsTab teamMembers={teamMembers} />
          )}
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
        inviteTeamMember={inviteTeamMember}
        onSuccess={() => {
          refreshTeam()
          showToast('Invite sent successfully')
        }}
      />

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  )
}
