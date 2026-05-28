import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import CrmGmailConnectCard from './CrmGmailConnectCard'

/**
 * Company reps: company domain send (no Google) or Gmail connect (needs verification / test user).
 */
export default function WorkEmailOptions({ onNavigate, compact = false }) {
  const { user } = useApp()
  const [orgEmail, setOrgEmail] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getOrgEmailDomain()
      setOrgEmail(data)
    } catch {
      setOrgEmail(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const userDomain = String(user?.email || '').split('@')[1]?.toLowerCase() || ''
  const companyDomain = orgEmail?.domain || orgEmail?.inferredDomain || userDomain

  if (loading) {
    return <p className="text-xs text-gray-500">Checking how you can send email…</p>
  }

  if (orgEmail?.userCanSend) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 space-y-1">
          <p className="font-semibold">Company email is ready</p>
          <p className="text-xs leading-relaxed">
            You are signed in as <strong>{user?.email}</strong>. Marketing and CRM will send through your company
            domain <strong>@{orgEmail.domain}</strong> — no Gmail connection required.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('marketing', { tab: 'campaigns' })}
            className="mt-2 text-xs font-semibold underline"
          >
            Go to Marketing campaigns
          </button>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">Manage your personal Work Gmail connection</p>
          <CrmGmailConnectCard compact />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50/90 px-4 py-3 text-xs text-blue-950 space-y-2 leading-relaxed">
        <p className="font-semibold text-sm text-blue-900">Google blocked “Connect work email”?</p>
        <p>
          That screen means Connect Intel’s app has not finished Google’s verification for sending mail. You
          can still send email two ways:
        </p>
        <div>
          <p className="font-semibold">Option 1 — Company domain (best for teams, no Google)</p>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            <li>
              Your <strong>company admin</strong> sets up outbound email for{' '}
              <strong>@{companyDomain || 'yourcompany.com'}</strong> (DNS in Resend — ask your admin to set this up).
            </li>
            <li>
              You sign in to Connect Intel with your <strong>@{companyDomain || 'company'}</strong> address
              (e.g. you@{companyDomain || 'xindus.com'}), not a personal Gmail.
            </li>
          </ul>
          {orgEmail?.configured && !orgEmail?.verified && (
            <p className="mt-2 text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              Domain <strong>{orgEmail.domain}</strong> is registered but DNS is not verified yet — ask your
              admin to finish DNS, then refresh this page.
            </p>
          )}
          {!orgEmail?.configured && (
            <p className="mt-2 text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              Company domain is not set up yet. Ask your admin to complete the <strong>Outbound email setup</strong> in their Workspace settings.
            </p>
          )}
          {orgEmail?.configured && orgEmail?.verified && orgEmail?.hint && (
            <p className="mt-2 text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              {orgEmail.hint}
            </p>
          )}
        </div>
        <div>
          <p className="font-semibold">Option 2 — Gmail connect (until Google approves the app)</p>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            <li>
              Connect Intel support adds your exact work address (e.g. <strong>{user?.email}</strong>) as a{' '}
              <strong>Test user</strong> in Google Cloud Console → Audience, or
            </li>
            <li>
              After you are added: on the Google screen use <strong>Advanced → Go to Connect Intel</strong>,
              then allow.
            </li>
            <li>If there is no Advanced link, Option 1 is required.</li>
          </ul>
        </div>
      </div>

      {!compact && (
        <>
          <p className="text-xs font-medium text-gray-700">Try Gmail connect (if you were added as a test user)</p>
          <CrmGmailConnectCard compact />
        </>
      )}
    </div>
  )
}
