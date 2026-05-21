import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { TEAM_PIPELINE_ROLES } from '../../lib/crmConstants'

export default function TeamPanel() {
  const {
    user,
    teamMembers,
    refreshTeam,
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [lastInviteUrl, setLastInviteUrl] = useState(null)

  useEffect(() => {
    refreshTeam()
  }, [refreshTeam])

  useEffect(() => {
    setCompanyName(user?.organizationName || '')
    setLogoUrl(user?.organizationLogoUrl || '')
  }, [user?.organizationName, user?.organizationLogoUrl])

  if (!user?.isOrgAdmin || user?.accountType !== 'company') {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Team management is available for company admins only.
      </div>
    )
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    setLastInviteUrl(null)
    try {
      const data = await inviteTeamMember({
        email: inviteEmail.trim(),
        canSearch: inviteCanSearch,
        pipelineRole: invitePipelineRole,
      })
      setInviteEmail('')
      if (data.inviteUrl) {
        setLastInviteUrl(data.inviteUrl)
        setNotice(
          data.emailSent
            ? `Invite email sent to ${inviteEmail.trim()}. They can also use the link below.`
            : `Invite created. Copy the link below (email not sent — add RESEND_API_KEY on Vercel).`
        )
      } else if (data.joinedImmediately) {
        setNotice('User already has an account — they were added to your team immediately.')
      }
      await refreshTeam()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBranding = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await updateTeamBranding({ name: companyName.trim(), logoUrl: logoUrl.trim() || null })
      updateUser(data.user)
      setNotice('Company branding updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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

  const changePipelineRole = async (member, pipelineRole) => {
    try {
      await updateMemberPermissions({ userId: member.userId, pipelineRole })
      setNotice(`Pipeline role updated for ${member.name}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f6f7f9]">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Team</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Email invites with secure links · Pipeline columns by role · Company searches: {user?.searchesLeft ?? 0}{' '}
          left
        </p>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-6 max-w-3xl">
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
              disabled={loading}
              className="text-xs font-semibold px-3 py-1.5 bg-gray-900 text-white rounded-md"
            >
              Save branding
            </button>
          </form>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Invite team member</h2>
          <form onSubmit={handleInvite} className="space-y-3">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Pipeline role</label>
              <select
                value={invitePipelineRole}
                onChange={(e) => setInvitePipelineRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
              />
              Can search leads (uses company search credits)
            </label>
            <button
              type="submit"
              disabled={loading}
              className="text-xs font-semibold px-3 py-2 bg-[#ffcb2b] text-[#242424] rounded-md"
            >
              Send invite
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

        {notice && <p className="text-xs text-green-800 bg-green-50 border border-green-100 rounded px-3 py-2">{notice}</p>}
        {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>}
      </div>
    </div>
  )
}
