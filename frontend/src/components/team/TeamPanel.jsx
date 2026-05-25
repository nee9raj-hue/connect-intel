import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { TEAM_PIPELINE_ROLES } from '../../lib/crmConstants'
import OrgPipelineImport from './OrgPipelineImport'
import InviteEmailSetup from './InviteEmailSetup'
import CrmGmailConnectCard from './CrmGmailConnectCard'

export default function TeamPanel({ onNavigate }) {
  const {
    user,
    teamMembers,
    refreshTeam,
    refreshSavedLeads,
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
  }, [refreshTeam])

  useEffect(() => {
    setCompanyName(user?.organizationName || '')
    setLogoUrl(user?.organizationLogoUrl || '')
  }, [user?.organizationName, user?.organizationLogoUrl])

  if (user?.isPlatformAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <h2 className="text-lg font-semibold text-gray-900">Company team area</h2>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          You are signed in as a <strong>Connect Intel platform operator</strong>. Use{' '}
          <strong>Data & imports</strong> in the sidebar to upload master sheets for all customers.
        </p>
        <button
          type="button"
          onClick={() => onNavigate?.('admin')}
          className="mt-4 px-4 py-2 bg-[#ffcb2b] text-[#242424] text-sm font-semibold rounded-lg"
        >
          Open Data & imports
        </button>
      </div>
    )
  }

  if (!user?.isOrgAdmin || user?.accountType !== 'company') {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Team management is available for company admins only.
      </div>
    )
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    const invited = inviteEmail.trim()
    if (!invited) return

    if (emailReady === false) {
      setError(
        'Invite email is not connected yet. Click “Connect invite@connectintel.net” below and sign in with that account (one time).'
      )
      return
    }

    setInviteLoading(true)
    setInviteStatus(`Sending invite to ${invited}…`)
    setError(null)
    setNotice(null)
    setLastInviteUrl(null)
    try {
      setInviteStatus(`Sending email from ${user?.name || 'you'} to ${invited}…`)
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
            ? `Email sent to ${invited}${via}. They were added to the team — sign in with ${invited}.`
            : `Invite email sent to ${invited}${via}. Replies go to ${user?.email}. They can also use the link below.`
        )
      } else {
        const detail = [data.emailError, data.emailHint].filter(Boolean).join(' ')
        setError(detail || 'Invite saved but email was not sent.')
        if (data.inviteUrl) {
          setNotice('Copy the invite link below and send it manually from your email.')
        } else if (data.joinedImmediately) {
          setNotice('User added to your team, but the notification email failed.')
        }
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
        setNotice(
          data.message ||
            `Test queued to ${user?.email}${data.resendId ? ` (ref: ${data.resendId})` : ''}. Check inbox and spam in 1–2 min.`
        )
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
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="panel-shell bg-[#f6f7f9]">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Team</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Email invites with secure links · Pipeline columns by role · Company searches: {user?.searchesLeft ?? 0}{' '}
          left
        </p>
      </header>

      <div className="panel-body-scroll p-5 space-y-6 max-w-3xl">
        <section className="rounded-xl border-2 border-teal-200/60 bg-gradient-to-br from-teal-50/80 to-white p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Active trading customers</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Upload shipment data (Excel/CSV) matched by mobile. See dashboard under{' '}
            <strong>CRM → Active customers</strong>.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('active-customers')}
            className="text-xs font-semibold px-3 py-2 bg-teal-700 text-white rounded-lg"
          >
            Open Active customers
          </button>
        </section>

        <section className="rounded-xl border-2 border-[#25D366]/40 bg-gradient-to-br from-emerald-50/90 to-white p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">WhatsApp automatic send</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Add your Meta WhatsApp Business API credentials on the dedicated settings page (sidebar:{' '}
            <strong>Workspace → WhatsApp API</strong>).
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('whatsapp-settings')}
            className="text-xs font-semibold px-3 py-2 bg-[#25D366] text-white rounded-lg"
          >
            Open WhatsApp API settings
          </button>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Company branding</h2>
          <form onSubmit={handleBranding} className="space-y-2">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="Logo image URL"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              type="submit"
              disabled={brandingLoading}
              className="text-xs font-semibold px-3 py-1.5 bg-gray-900 text-white rounded-md disabled:opacity-60"
            >
              {brandingLoading ? 'Saving…' : 'Save branding'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">CRM email</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Connect each rep&apos;s work email once — send from Pipeline and sync replies. No DNS setup required.
          </p>
          <CrmGmailConnectCard />
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Invite team member</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            {emailReady ? (
              <>
                Invites send from <strong>invite@connectintel.net</strong>. Recipients see{' '}
                <span className="font-medium text-gray-700">{user?.name}</span>; replies go to{' '}
                <span className="font-medium text-gray-700">{user?.email}</span>.
              </>
            ) : (
              <>
                Invites email your teammate from <strong>invite@connectintel.net</strong> with your name (
                <span className="font-medium text-gray-700">{user?.name}</span>) and{' '}
                <span className="font-medium text-gray-700">{user?.email}</span> as reply-to.
              </>
            )}
          </p>
          <InviteEmailSetup onStatusChange={(ready) => setEmailReady(ready)} />
          <button
            type="button"
            onClick={handleTestInviteEmail}
            disabled={testEmailLoading || inviteLoading || emailReady === false}
            className="text-xs font-semibold px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {testEmailLoading ? 'Sending test…' : `Send test invite to ${user?.email}`}
          </button>
          <form onSubmit={handleInvite} className="space-y-3">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              disabled={inviteLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500"
            />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Pipeline role</label>
              <select
                value={invitePipelineRole}
                onChange={(e) => setInvitePipelineRole(e.target.value)}
                disabled={inviteLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
              >
                {TEAM_PIPELINE_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} — {r.description}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={inviteCanSearch}
                onChange={(e) => setInviteCanSearch(e.target.checked)}
                disabled={inviteLoading}
              />
              Can search leads (uses company search credits)
            </label>

            {inviteLoading && inviteStatus && (
              <div
                className="flex items-center gap-3 rounded-lg border border-[#ffe48a] bg-[#fffbeb] px-3 py-3"
                role="status"
                aria-live="polite"
              >
                <span className="w-5 h-5 border-2 border-[#ffcb2b]/40 border-t-[#ffcb2b] rounded-full animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#5b4a00]">Sending invite…</p>
                  <p className="text-xs text-[#8a6600] mt-0.5">{inviteStatus}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={inviteLoading || !inviteEmail.trim() || emailReady === false}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 bg-[#ffcb2b] hover:bg-[#f0bc00] text-[#242424] rounded-lg disabled:opacity-60 min-w-[140px]"
              title={
                emailReady === false
                  ? 'Connect invite@connectintel.net first (yellow box above)'
                  : undefined
              }
            >
              {inviteLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#242424]/30 border-t-[#242424] rounded-full animate-spin" />
                  Sending invite…
                </>
              ) : (
                'Send invite'
              )}
            </button>
          </form>
          {lastInviteUrl && (
            <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2">
              <p className="font-semibold text-gray-700 mb-1">Invite link</p>
              <input readOnly value={lastInviteUrl} className="w-full text-[11px] bg-white border border-gray-200 rounded px-2 py-1" onFocus={(e) => e.target.select()} />
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-100">Members</h2>
          {teamMembers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">No team members yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {teamMembers.map((m) => (
                <li key={m.userId} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {m.name}
                      {m.role === 'org_admin' && (
                        <span className="ml-1 text-[10px] font-semibold text-[#8a6600] bg-[#fffbeb] px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{m.email}</p>
                  </div>
                  {m.role !== 'org_admin' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={m.pipelineRole || 'member'}
                        onChange={(e) => changePipelineRole(m, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1"
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
                        className={`text-xs font-medium px-2 py-1 rounded border ${
                          m.canSearch
                            ? 'border-green-200 bg-green-50 text-green-800'
                            : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        Search: {m.canSearch ? 'On' : 'Off'}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <OrgPipelineImport
          onImported={async () => {
            await refreshSavedLeads()
            setNotice('Pipeline import complete — open Pipeline to follow up.')
          }}
        />

        {notice && <p className="text-xs text-green-800 bg-green-50 border border-green-100 rounded px-3 py-2">{notice}</p>}
        {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>}
      </div>
    </div>
  )
}
