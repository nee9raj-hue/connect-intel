import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import CrmGmailConnectCard from '../team/CrmGmailConnectCard'
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
  const [gmailStatus, setGmailStatus] = useState(null)
  const [orgEmail, setOrgEmail] = useState(null)

  const load = useCallback(async () => {
    try {
      const [dash, gmail, domain] = await Promise.all([
        api.getMarketingDashboard('30d'),
        api.getCrmGmailStatus().catch(() => null),
        api.getOrgEmailDomain().catch(() => null),
      ])
      setProvider(dash?.orgSettings?.emailProvider || 'auto')
      setGmailStatus(gmail)
      setOrgEmail(domain)
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    if (user?.accountType === 'company') load()
  }, [user, load])

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

  const gmailConnected = Boolean(gmailStatus?.connected)
  const dnsVerified = Boolean(orgEmail?.verified || orgEmail?.userCanSend)
  const sendingReady = gmailConnected || dnsVerified

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="crm-section-title mb-1">Sender setup</h2>
        <p className="text-xs text-[#516f90]">
          Marketing can send through a connected work mailbox or through your company domain (DNS). You only need one
          path — not both.
        </p>
      </div>

      {user?.accountType !== 'company' ? (
        <p className="text-sm text-gray-600">
          Company email domains are available on team accounts. Connect work Gmail under Tips for individual sends.
        </p>
      ) : isAdmin ? (
        <>
          {sendingReady ? (
            <div className="space-y-3">
              {gmailConnected && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 space-y-1">
                  <p className="font-semibold">Sending via connected work email</p>
                  <p className="text-xs leading-relaxed">
                    Campaigns send from <strong>{gmailStatus.mailbox}</strong>. Manage this under{' '}
                    <strong>Team &amp; email</strong> — DNS setup below is optional.
                  </p>
                </div>
              )}
              {dnsVerified && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 space-y-1">
                  <p className="font-semibold">Company domain verified</p>
                  <p className="text-xs leading-relaxed">
                    All reps on <strong>@{orgEmail.domain}</strong> can send without connecting Gmail individually.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#33475b]">
                Connect work email under <strong>Team &amp; email</strong>, or finish company DNS below so campaigns can
                send.
              </p>
              <CrmGmailConnectCard compact />
            </div>
          )}

          {!dnsVerified && (
            <OrgCrmEmailSetup
              autoSetup={!gmailConnected}
              collapsed={gmailConnected}
              title="Advanced: company DNS (optional)"
            />
          )}

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
        <div className="crm-content-card p-4 text-sm text-[#33475b] space-y-3">
          {gmailConnected ? (
            <p className="text-green-800 font-medium">
              Your work email is connected — campaigns send from <strong>{gmailStatus.mailbox}</strong>.
            </p>
          ) : user?.orgOutboundEmailReady ? (
            <p className="text-green-700 font-medium">
              Your company domain is verified — you can send campaigns from @{user?.orgEmailDomain}.
            </p>
          ) : (
            <p>
              Ask your admin to connect work email under <strong>Team &amp; email</strong>, or finish DNS domain setup.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
