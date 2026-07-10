import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

export default function OnboardingModal() {
  const { completeOnboarding, logout, user } = useApp()
  const [accountType, setAccountType] = useState('company')
  const [companyName, setCompanyName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [workspaceLookup, setWorkspaceLookup] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [accessSent, setAccessSent] = useState(false)
  const [accessLoading, setAccessLoading] = useState(false)

  useEffect(() => {
    if (accountType !== 'company') {
      setWorkspaceLookup(null)
      return
    }
    setLookupLoading(true)
    api
      .getOrgWorkspaceLookup()
      .then((data) => {
        setWorkspaceLookup(data)
        if (data?.pendingAccessRequest) setAccessSent(true)
      })
      .catch(() => setWorkspaceLookup(null))
      .finally(() => setLookupLoading(false))
  }, [accountType])

  const domainWorkspaceBlocked =
    accountType === 'company' &&
    workspaceLookup?.companyWorkspaceExists &&
    !workspaceLookup?.alreadyMember

  const submit = async (e) => {
    e.preventDefault()
    if (domainWorkspaceBlocked) {
      setError(
        `A company workspace already exists for @${workspaceLookup.domain}. Request access or continue as Individual.`
      )
      return
    }
    setLoading(true)
    setError(null)
    try {
      await completeOnboarding({
        accountType,
        companyName: accountType === 'company' ? companyName.trim() : undefined,
        logoUrl: accountType === 'company' ? logoUrl.trim() || null : null,
        mobile: mobile.trim(),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const continueIndividual = async () => {
    if (!mobile.trim()) {
      setError('Mobile number is required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await completeOnboarding({
        accountType: 'individual',
        mobile: mobile.trim(),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const requestAccess = async () => {
    if (!mobile.trim()) {
      setError('Add your mobile so an admin can reach you.')
      return
    }
    setAccessLoading(true)
    setError(null)
    try {
      await api.requestOrgAccess({ mobile: mobile.trim() })
      setAccessSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setAccessLoading(false)
    }
  }

  const adminPreview = (workspaceLookup?.adminContacts || []).slice(0, 2)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 p-6 space-y-4"
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Welcome to Connect Intel</h2>
          <p className="text-sm text-gray-500 mt-1">
            Set up your sales workspace — pipeline, team, and email. AI lead search is a separate product you can add
            later.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'individual', title: 'Individual', sub: 'Solo CRM — your own pipeline' },
            { id: 'company', title: 'Company', sub: 'Shared CRM — invite your team' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setAccountType(opt.id)
                setError(null)
              }}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                accountType === opt.id
                  ? 'border-[#FF773D] bg-[#fff4ee]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{opt.sub}</p>
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Your mobile (WhatsApp)</label>
          <input
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Same number you use on WhatsApp — for customer outreach from CRM.</p>
        </div>

        {accountType === 'company' && lookupLoading && (
          <p className="text-xs text-gray-500">Checking your company domain…</p>
        )}

        {domainWorkspaceBlocked && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-950 space-y-2 leading-relaxed">
            <p className="font-semibold text-sm">
              {workspaceLookup.organizationName} already uses Connect Intel
            </p>
            <p>
              Your email <strong>{user?.email}</strong> matches <strong>@{workspaceLookup.domain}</strong>. Company
              workspaces are invite-only — ask an admin to add you, or request access below.
            </p>
            {adminPreview.length > 0 && (
              <p>
                Workspace admin{adminPreview.length > 1 ? 's' : ''}:{' '}
                {adminPreview.map((admin) => admin.name || admin.email).join(', ')}
              </p>
            )}
            {accessSent ? (
              <p className="text-green-800 bg-green-50 border border-green-100 rounded px-2 py-1.5">
                Access request sent. An admin will invite you from Team → Members.
              </p>
            ) : (
              <button
                type="button"
                onClick={requestAccess}
                disabled={accessLoading}
                className="w-full py-2 text-sm font-semibold bg-white border border-amber-300 rounded-lg disabled:opacity-60"
              >
                {accessLoading ? 'Sending…' : 'Request access from admin'}
              </button>
            )}
          </div>
        )}

        {accountType === 'company' && !domainWorkspaceBlocked && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Company name</label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Exports Pvt Ltd"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Logo URL <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">
              You become the company admin. Invite teammates from Team → Members. If your company already uses Connect
              Intel, ask your admin for an invite instead of signing up again.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">{error}</p>
        )}

        {!domainWorkspaceBlocked && (
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#FF773D] hover:bg-[#e5652f] text-[#242424] font-semibold rounded-lg text-sm disabled:opacity-60"
          >
            {loading ? 'Setting up…' : 'Continue to workspace'}
          </button>
        )}

        {domainWorkspaceBlocked && (
          <button
            type="button"
            onClick={continueIndividual}
            disabled={loading}
            className="w-full py-2.5 bg-[#FF773D] hover:bg-[#e5652f] text-[#242424] font-semibold rounded-lg text-sm disabled:opacity-60"
          >
            {loading ? 'Setting up…' : 'Continue as Individual (solo pipeline)'}
          </button>
        )}

        <button type="button" onClick={() => logout()} className="w-full text-xs text-gray-500 underline">
          Sign out — use a different account
        </button>
      </form>
    </div>
  )
}
