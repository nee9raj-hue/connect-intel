import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { TEAM_PIPELINE_ROLES } from '../../lib/crmConstants'
import OrgPipelineImport from './OrgPipelineImport'
import OrgLeadTagsPanel from './OrgLeadTagsPanel'
import InviteEmailSetup from './InviteEmailSetup'
import CrmGmailConnectCard from './CrmGmailConnectCard'
import TeamSettingsSection, { TeamQuickLink, TeamStatCard } from './TeamSettingsSection'

function memberInitials(name, email) {
  const n = String(name || '').trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return n.slice(0, 2).toUpperCase()
  }
  return String(email || '?').slice(0, 2).toUpperCase()
}

export default function TeamPanel({ onNavigate }) {
  const {
    user,
    teamMembers,
    orgLeadTags,
    refreshTeam,
    refreshSavedLeads,
    refreshOrgLeadTags,
    inviteTeamMember,
    updateTeamBranding,
    updateMemberPermissions,
    updateUser,
  } = useApp()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteCanSearch, setInviteCanSearch] = useState(false)
  const [invitePipelineRole, setInvitePipelineRole] = useState('member')
  const [companyName, setCompanyName] = useState(user?.organizationName || '')
  const [logoUrl, setLogoUrl] = useState(user?.organizationLogoUrl || '')
  const [brandingLoading, setBrandingLoading] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteStatus, setInviteStatus] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [lastInviteUrl, setLastInviteUrl] = useState(null)
  const [emailReady, setEmailReady] = useState(null)
  const [testEmailLoading, setTestEmailLoading] = useState(false)

  useEffect(() => {
    refreshTeam()
    refreshOrgLeadTags?.()
  }, [refreshTeam, refreshOrgLeadTags])

  useEffect(() => {
    setCompanyName(user?.organizationName || '')
    setLogoUrl(user?.organizationLogoUrl || '')
  }, [user?.organizationName, user?.organizationLogoUrl])

  const adminCount = useMemo(
    () => teamMembers.filter((m) => m.role === 'org_admin').length,
    [teamMembers]
  )

  if (user?.isPlatformAdmin) {
    return (
      <div className="panel-shell bg-[#f3f4f6]">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <span className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gray-900 text-[#ffcb2b] mb-4">
              <DatabaseIcon className="w-6 h-6" />
            </span>
            <h2 className="text-lg font-semibold text-gray-900">Platform operator</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Company team settings are for customer workspaces. Use <strong>Data & imports</strong> for master
              sheets.
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.('admin')}
              className="mt-5 px-4 py-2.5 bg-[#ffcb2b] text-[#242424] text-sm font-semibold rounded-lg hover:bg-[#f0bc00]"
            >
              Open Data & imports
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!user?.isOrgAdmin || user?.accountType !== 'company') {
    return (
      <div className="panel-shell bg-[#f3f4f6]">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <span className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gray-900 text-[#ffcb2b] mb-4">
              <MailIcon className="w-6 h-6" />
            </span>
            <h2 className="text-lg font-semibold text-gray-900">Work email</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Team administration is for company admins. Connect your own Gmail to send from Pipeline.
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.('my-email')}
              className="mt-5 px-4 py-2.5 bg-[#ffcb2b] text-[#242424] text-sm font-semibold rounded-lg hover:bg-[#f0bc00]"
            >
              Open Work email
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    const invited = inviteEmail.trim()
    if (!invited) return

    if (emailReady === false) {
      setError(
        'Invite email is not connected yet. Expand Email & invites and connect invite@connectintel.net first.'
      )
      return
    }

    setInviteLoading(true)
    setInviteStatus(`Sending invite to ${invited}…`)
    setError(null)
    setNotice(null)
    setLastInviteUrl(null)
    try {
      const data = await inviteTeamMember({
        email: invited,
        canSearch: inviteCanSearch,
        pipelineRole: invitePipelineRole,
      })
      setInviteEmail('')
      if (data.inviteUrl) setLastInviteUrl(data.inviteUrl)

      if (data.emailSent) {
        const via = data.emailProvider ? ` via ${data.emailProvider}` : ''
        setNotice(
          data.joinedImmediately
            ? `Email sent to ${invited}${via}. They were added to the team.`
            : `Invite sent to ${invited}${via}. Replies go to ${user?.email}.`
        )
      } else {
        const detail = [data.emailError, data.emailHint].filter(Boolean).join(' ')
        setError(detail || 'Invite saved but email was not sent.')
        if (data.inviteUrl) setNotice('Copy the invite link below and send it manually.')
      }
      setInviteStatus(null)
      await refreshTeam()
    } catch (err) {
      setInviteStatus(null)
      setError(err.message)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleBranding = async (e) => {
    e.preventDefault()
    setBrandingLoading(true)
    setError(null)
    try {
      const data = await updateTeamBranding({ name: companyName.trim(), logoUrl: logoUrl.trim() || null })
      updateUser(data.user)
      setNotice('Company branding updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBrandingLoading(false)
    }
  }

  const toggleSearch = async (member) => {
    try {
      await updateMemberPermissions({ userId: member.userId, canSearch: !member.canSearch })
      setNotice(`Updated search access for ${member.name}`)
      await refreshTeam()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleTestInviteEmail = async () => {
    setTestEmailLoading(true)
    setError(null)
    setNotice(null)
    try {
      const data = await api.sendInviteTestEmail()
      if (data.emailSent) {
        setNotice(data.message || `Test email queued to ${user?.email}`)
      } else {
        setError([data.emailError, data.emailHint, data.message].filter(Boolean).join(' ') || 'Test email failed.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setTestEmailLoading(false)
    }
  }

  const changePipelineRole = async (member, pipelineRole) => {
    try {
      await updateMemberPermissions({ userId: member.userId, pipelineRole })
      setNotice(`Pipeline role updated for ${member.name}`)
      await refreshTeam()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="panel-shell bg-[#f3f4f6]">
      <header className="shrink-0 bg-white border-b border-gray-200/90 px-5 py-4 md:px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900 tracking-tight">Team & workspace</h1>
            <p className="text-xs text-gray-500 mt-1 max-w-xl leading-relaxed">
              Manage people, email, branding, tags, and imports — expand each section as you need it.
            </p>
          </div>
          {user?.organizationLogoUrl ? (
            <img
              src={user.organizationLogoUrl}
              alt=""
              className="h-9 w-9 rounded-lg object-cover border border-gray-200"
            />
          ) : (
            <span className="h-9 px-3 rounded-lg bg-gray-900 text-[#ffcb2b] text-xs font-bold flex items-center">
              {user?.organizationName?.slice(0, 2)?.toUpperCase() || 'CI'}
            </span>
          )}
        </div>
      </header>

      <div className="panel-body-scroll">
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
          {(notice || error) && (
            <div className="space-y-2">
              {notice && (
                <p
                  className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200/80 rounded-xl px-4 py-2.5 flex items-start gap-2"
                  role="status"
                >
                  <CheckIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  {notice}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-800 bg-red-50 border border-red-200/80 rounded-xl px-4 py-2.5" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <TeamStatCard
              icon={UsersIcon}
              label="Team members"
              value={teamMembers.length}
              hint={`${adminCount} admin${adminCount === 1 ? '' : 's'}`}
            />
            <TeamStatCard
              icon={SearchIcon}
              label="AI searches"
              value={user?.searchesLeft ?? 0}
              hint="Company pool remaining"
              accent="amber"
            />
            <TeamStatCard
              icon={MailIcon}
              label="Invite email"
              value={emailReady === false ? 'Setup' : emailReady ? 'Ready' : '…'}
              hint="invite@connectintel.net"
              accent={emailReady ? 'green' : 'gray'}
            />
            <TeamStatCard
              icon={TagIcon}
              label="Lead tags"
              value={orgLeadTags?.length ?? 0}
              hint="For pipeline segmentation"
              accent="blue"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <TeamQuickLink
              icon={ChartIcon}
              title="Active trading customers"
              description="Upload shipment data · CRM dashboard"
              accent="teal"
              onClick={() => onNavigate?.('active-customers')}
            />
            <TeamQuickLink
              icon={WhatsAppIcon}
              title="WhatsApp API"
              description="Meta Cloud API for outbound & inbox"
              accent="whatsapp"
              onClick={() => onNavigate?.('whatsapp-settings')}
            />
            <TeamQuickLink
              icon={WalletIcon}
              title="Team & billing"
              description="Company details, recharge, invoices"
              accent="amber"
              onClick={() => onNavigate?.('admin-customers')}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              <TeamSettingsSection
                id="members"
                icon={UsersIcon}
                title="Team members"
                description="Roles, search access, and pipeline permissions"
                badge={
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 tabular-nums">
                    {teamMembers.length}
                  </span>
                }
                defaultOpen
              >
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No team members yet — send an invite below.</p>
                ) : (
                  <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                    {teamMembers.map((m) => (
                      <li
                        key={m.userId}
                        className="flex flex-wrap items-center gap-3 px-3 py-3 bg-white hover:bg-gray-50/80 transition-colors"
                      >
                        <span className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {memberInitials(m.name, m.email)}
                        </span>
                        <div className="flex-1 min-w-[140px]">
                          <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                            {m.name}
                            {m.role === 'org_admin' && (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-[#8a6600] bg-[#fffbeb] px-1.5 py-0.5 rounded">
                                Admin
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{m.email}</p>
                        </div>
                        {m.role !== 'org_admin' && (
                          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
                            <select
                              value={m.pipelineRole || 'member'}
                              onChange={(e) => changePipelineRole(m, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white"
                            >
                              {TEAM_PIPELINE_ROLES.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => toggleSearch(m)}
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                                m.canSearch
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <SearchIcon className="w-3.5 h-3.5" />
                              {m.canSearch ? 'Search on' : 'Search off'}
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TeamSettingsSection>

              <TeamSettingsSection
                id="email"
                icon={MailIcon}
                title="Email & invites"
                description="CRM Gmail, invite delivery, and new teammates"
                defaultOpen
              >
                <div className="space-y-5 pt-1">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                    <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <MailIcon className="w-3.5 h-3.5" />
                      Your CRM email (Gmail)
                    </p>
                    <CrmGmailConnectCard />
                  </div>

                  <div className="rounded-xl border border-[#ffe48a]/60 bg-[#fffbeb]/50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-[#5b4a00]">Team invite system</p>
                    <p className="text-[11px] text-[#8a6600] leading-relaxed">
                      Invites send from <strong>invite@connectintel.net</strong> with your name; replies go to{' '}
                      <strong>{user?.email}</strong>.
                    </p>
                    <InviteEmailSetup onStatusChange={(ready) => setEmailReady(ready)} />
                    <button
                      type="button"
                      onClick={handleTestInviteEmail}
                      disabled={testEmailLoading || inviteLoading || emailReady === false}
                      className="text-xs font-semibold px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {testEmailLoading ? 'Sending test…' : `Send test to ${user?.email}`}
                    </button>
                  </div>

                  <form onSubmit={handleInvite} className="space-y-3">
                    <p className="text-xs font-semibold text-gray-700">Invite a teammate</p>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      disabled={inviteLoading}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-900/10"
                    />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-1">
                          Pipeline role
                        </label>
                        <select
                          value={invitePipelineRole}
                          onChange={(e) => setInvitePipelineRole(e.target.value)}
                          disabled={inviteLoading}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        >
                          {TEAM_PIPELINE_ROLES.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-gray-600 sm:mt-5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteCanSearch}
                          onChange={(e) => setInviteCanSearch(e.target.checked)}
                          disabled={inviteLoading}
                          className="rounded border-gray-300"
                        />
                        Can use AI prospect search
                      </label>
                    </div>

                    {inviteLoading && inviteStatus && (
                      <div
                        className="flex items-center gap-3 rounded-lg border border-[#ffe48a] bg-[#fffbeb] px-3 py-2.5"
                        role="status"
                      >
                        <span className="w-4 h-4 border-2 border-[#ffcb2b]/40 border-t-[#ffcb2b] rounded-full animate-spin shrink-0" />
                        <p className="text-xs text-[#8a6600]">{inviteStatus}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={inviteLoading || !inviteEmail.trim() || emailReady === false}
                      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-sm font-semibold px-5 py-2.5 bg-[#ffcb2b] hover:bg-[#f0bc00] text-[#242424] rounded-lg disabled:opacity-50"
                    >
                      {inviteLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-[#242424]/30 border-t-[#242424] rounded-full animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <SendIcon className="w-4 h-4" />
                          Send invite
                        </>
                      )}
                    </button>
                  </form>

                  {lastInviteUrl && (
                    <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="font-semibold text-gray-700 mb-1.5">Invite link (backup)</p>
                      <input
                        readOnly
                        value={lastInviteUrl}
                        className="w-full text-[11px] bg-white border border-gray-200 rounded-lg px-2 py-1.5 font-mono"
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  )}
                </div>
              </TeamSettingsSection>
            </div>

            <div className="space-y-4">
              <TeamSettingsSection
                id="workspace"
                icon={BuildingIcon}
                title="Company workspace"
                description="Branding shown in the app and lead tags for your team"
                defaultOpen={false}
              >
                <div className="space-y-6 pt-1">
                  <form onSubmit={handleBranding} className="space-y-3">
                    <p className="text-xs font-semibold text-gray-700">Branding</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company name"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                      />
                      <input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="Logo image URL"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={brandingLoading}
                      className="text-xs font-semibold px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-60"
                    >
                      {brandingLoading ? 'Saving…' : 'Save branding'}
                    </button>
                  </form>

                  <div className="border-t border-gray-100 pt-5">
                    <OrgLeadTagsPanel embedded onTagsChange={refreshOrgLeadTags} />
                  </div>
                </div>
              </TeamSettingsSection>

              <TeamSettingsSection
                id="data"
                icon={UploadIcon}
                title="Pipeline import"
                description="Bulk upload leads from CSV or Excel"
                defaultOpen={false}
              >
                <OrgPipelineImport
                  embedded
                  onImported={async () => {
                    await refreshSavedLeads()
                    setNotice('Pipeline import complete — open Pipeline to follow up.')
                  }}
                />
              </TeamSettingsSection>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function UsersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function MailIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function SearchIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function TagIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  )
}

function BuildingIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

function UploadIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function ChartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function WalletIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7.5A2.5 2.5 0 015.5 5h12A2.5 2.5 0 0120 7.5v9a2.5 2.5 0 01-2.5 2.5h-12A2.5 2.5 0 013 16.5v-9z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 10h-4a2 2 0 100 4h4" />
    </svg>
  )
}

function WhatsAppIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function SendIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function DatabaseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  )
}
