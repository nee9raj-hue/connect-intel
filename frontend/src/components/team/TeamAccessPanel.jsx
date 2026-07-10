import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { C } from './settings/settingsTheme'

export default function TeamAccessPanel({ user, onNavigate }) {
  const [lookup, setLookup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessSent, setAccessSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const inCompany = user?.accountType === 'company' && user?.organizationId

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .getOrgWorkspaceLookup()
      .then((data) => {
        if (!cancelled) {
          setLookup(data)
          if (data?.pendingAccessRequest) setAccessSent(true)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.email])

  const requestAccess = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.requestOrgAccess({})
      setAccessSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (inCompany) {
    return (
      <div className="panel-shell flex items-center justify-center p-8">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-8 space-y-3">
          <h2 className="text-lg font-medium text-gray-900">Team administration</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Only company admins can invite teammates and change roles. You are a member of{' '}
            <strong>{user.organizationName || 'your workspace'}</strong>.
          </p>
          {lookup?.adminContacts?.length > 0 ? (
            <p className="text-xs text-gray-600">
              Ask{' '}
              {lookup.adminContacts
                .map((admin) => admin.name || admin.email)
                .slice(0, 2)
                .join(' or ')}{' '}
              to invite colleagues from Team → Members.
            </p>
          ) : (
            <p className="text-xs text-gray-600">
              No workspace admin is assigned yet. Contact your Connect Intel operator at invite@connectintel.net to
              grant admin access.
            </p>
          )}
          <button
            type="button"
            onClick={() => onNavigate?.('my-email')}
            className="mt-2 px-4 py-2.5 text-sm font-medium rounded-lg text-white"
            style={{ background: C.accent }}
          >
            Open Work email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel-shell flex items-center justify-center p-8">
      <div className="max-w-md bg-white rounded-2xl border border-gray-200 p-8 space-y-3">
        <h2 className="text-lg font-medium text-gray-900">Join your company workspace</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Checking your email domain…</p>
        ) : lookup?.companyWorkspaceExists ? (
          <>
            <p className="text-sm text-gray-500 leading-relaxed">
              <strong>{lookup.organizationName}</strong> already has a Connect Intel workspace for @
              {lookup.domain}. Teammates join by invite — same domain does not auto-join.
            </p>
            {lookup.adminContacts?.length > 0 && (
              <p className="text-xs text-gray-600">
                Workspace admin{lookup.adminContacts.length > 1 ? 's' : ''}:{' '}
                {lookup.adminContacts.map((admin) => admin.name || admin.email).join(', ')}
              </p>
            )}
            {accessSent ? (
              <p className="text-xs text-green-800 bg-green-50 border border-green-100 rounded px-2 py-1.5">
                Access request sent. An admin will invite you from Team → Members.
              </p>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={requestAccess}
                className="w-full py-2.5 text-sm font-semibold rounded-lg text-[#242424] disabled:opacity-60"
                style={{ background: C.accent }}
              >
                {busy ? 'Sending…' : 'Request access from admin'}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500 leading-relaxed">
            Team settings are for company workspaces. Complete onboarding as Company to create a workspace, or ask your
            admin for an invite link.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">{error}</p>
        )}
        <button
          type="button"
          onClick={() => onNavigate?.('my-email')}
          className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700"
        >
          Open Work email
        </button>
      </div>
    </div>
  )
}
