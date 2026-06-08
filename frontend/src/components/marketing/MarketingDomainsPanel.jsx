import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import OrgCrmEmailSetup from '../team/OrgCrmEmailSetup'

const PROVIDERS = [
  { id: 'auto', label: 'Auto (Resend → Gmail fallback)' },
  { id: 'resend', label: 'Resend (primary)' },
  { id: 'gmail', label: 'Gmail (user mailbox)' },
  { id: 'ses', label: 'Amazon SES' },
  { id: 'sendgrid', label: 'SendGrid' },
]

export default function MarketingDomainsPanel({ user }) {
  const isAdmin = Boolean(user?.isOrgAdmin)
  const [provider, setProvider] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.getMarketingDashboard('30d')
      const p = res?.orgSettings?.emailProvider || 'auto'
      setProvider(p)
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    if (user?.accountType === 'company' && isAdmin) load()
  }, [user, isAdmin, load])

  const saveProvider = async (next) => {
    setProvider(next)
    setBusy(true)
    setNotice(null)
    try {
      await api.updateMarketingOrgSettings({ emailProvider: next })
      setNotice('Default email provider saved for new campaigns.')
    } catch (e) {
      setNotice(e.message || 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="crm-section-title mb-1">Sender domain</h2>
        <p className="text-xs text-[#516f90]">
          Verify your company domain for bulk marketing email. SPF, DKIM, and DMARC are configured via Resend.
        </p>
      </div>

      {user?.accountType !== 'company' ? (
        <p className="text-sm text-gray-600">
          Company email domains are available on team accounts. Connect work Gmail under Tips for individual sends.
        </p>
      ) : isAdmin ? (
        <>
          <OrgCrmEmailSetup />
          <div className="marketing-auto-card space-y-2">
            <h3 className="text-sm font-semibold text-[#33475b]">Default email provider</h3>
            <p className="text-xs text-[#516f90]">
              Resend and Gmail remain primary. SES and SendGrid are optional when API keys are configured server-side.
            </p>
            <select
              className="ci-input w-full"
              value={provider}
              disabled={busy}
              onChange={(e) => saveProvider(e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {notice && <p className="text-xs text-[#516f90]">{notice}</p>}
          </div>
        </>
      ) : (
        <div className="crm-content-card p-4 text-sm text-[#33475b]">
          <p>
            Your admin manages domain verification. When verified, you can send campaigns from your work email
            address on <strong>@{user?.orgEmailDomain || 'your company domain'}</strong>.
          </p>
          {user?.orgOutboundEmailReady ? (
            <p className="mt-2 text-green-700 font-medium">Your domain is verified — you can send campaigns.</p>
          ) : (
            <p className="mt-2 text-amber-800">Domain not verified yet — ask your admin to finish DNS setup.</p>
          )}
        </div>
      )}
    </div>
  )
}
