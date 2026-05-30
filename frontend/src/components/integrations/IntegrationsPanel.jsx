import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { PRODUCT } from '../../lib/productCopy'
import InviteEmailSetup from '../team/InviteEmailSetup'
import OrgWhatsAppCloudSetup from '../team/OrgWhatsAppCloudSetup'

const PARTNERS = [
  {
    id: 'connect-intel',
    label: 'Connect Intel database',
    icon: '📊',
    description: 'India B2B records plus leads your team adds to the pipeline.',
    status: 'active',
  },
  {
    id: 'ai',
    label: 'AI prospect search',
    icon: '✨',
    description: 'Smart matching and lead discovery from your search filters.',
    status: 'active',
  },
  {
    id: 'gmail',
    label: 'Work email',
    icon: '✉️',
    description: 'Send outreach from your inbox — connect under Team or on any lead’s Email tab.',
    status: 'active',
  },
  {
    id: 'crm',
    label: 'CRM sync',
    icon: '🔗',
    description: 'Sync with external CRM and pipeline tools — enterprise rollout.',
    status: 'soon',
  },
  {
    id: 'enrichment',
    label: 'Global enrichment',
    icon: '🌐',
    description: 'Expanded contact verification and international data partners.',
    status: 'soon',
  },
]

export default function IntegrationsPanel() {
  const { user } = useApp()
  const isOperator = Boolean(user?.isPlatformAdmin)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!isOperator) return
    let cancelled = false
    api
      .getIntegrationStatus()
      .then((data) => {
        if (!cancelled) setStatus(data.providers || data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isOperator])

  if (!isOperator) {
    const isCompanyAdmin = user?.isOrgAdmin && user?.accountType === 'company'
    return (
      <div className="panel-shell">
        <div className="panel-body-scroll p-6 max-w-3xl">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Connected services</h1>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          {PRODUCT.tagline} Your workspace includes AI prospect search, pipeline CRM, and optional work
          email for sending. Company admins manage team access and imports under <strong>Team</strong>.
        </p>
        {isCompanyAdmin && (
          <section className="mb-6 rounded-xl border border-[#25D366]/40 bg-white p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">WhatsApp Business API</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Enable automatic bulk WhatsApp from Marketing and Pipeline. Also available under{' '}
              <strong>Team</strong>.
            </p>
            <OrgWhatsAppCloudSetup scope="org" />
          </section>
        )}
        <div className="space-y-4">
          {PARTNERS.filter((p) => p.status === 'active').map((partner) => (
            <PartnerCard key={partner.id} partner={partner} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-8">
          More data partners and CRM sync are on the roadmap for enterprise plans.
        </p>
        </div>
      </div>
    )
  }

  const storageOk = status?.supabaseConnected
  const storageLabel = status?.storage === 'supabase' ? 'Cloud database' : 'Local database'

  return (
    <div className="panel-shell">
      <div className="panel-body-scroll p-6 max-w-3xl">
      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
        <strong>Platform operator view.</strong> Internal service status for Connect Intel operations.
      </p>

      <div
        className={`text-sm rounded-lg px-4 py-3 mb-6 border ${
          storageOk
            ? 'text-green-800 bg-green-50 border-green-200'
            : 'text-amber-900 bg-amber-50 border-amber-200'
        }`}
      >
        <strong>Storage: {storageLabel}</strong>
        {status?.builtInRecords != null && (
          <span className="block mt-1">{status.builtInRecords.toLocaleString()} contacts in database.</span>
        )}
        {!storageOk && status?.supabaseError && (
          <span className="block mt-2 text-xs leading-relaxed">{status.supabaseError}</span>
        )}
        {!storageOk && status?.supabaseEnv && (
          <span className="block mt-1 text-xs font-mono text-amber-800/90">
            SUPABASE_URL set: {status.supabaseEnv.urlSet ? 'yes' : 'no'} · KEY set:{' '}
            {status.supabaseEnv.keySet ? 'yes' : 'no'}
            {status.supabaseEnv.urlHost ? ` · host: ${status.supabaseEnv.urlHost}` : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6 text-xs">
        <StatusPill label="Live AI search" on={status?.perplexity} />
        <StatusPill label="Keyword AI" on={status?.gemini} />
        <StatusPill label="Database env" on={status?.supabase} />
        <StatusPill label="Database live" on={status?.supabaseConnected} />
        <StatusPill label="Team invite email" on={status?.inviteEmailReady} />
        <StatusPill label="WhatsApp auto-send" on={status?.whatsappAutoSendReady} />
      </div>

      <section className="mb-8 rounded-xl border-2 border-blue-200 bg-blue-50/80 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#242424]">Google OAuth — work Gmail for all customers</h2>
        <p className="text-xs text-blue-950 leading-relaxed">
          Phase: <strong>{status?.googleOAuthPhase || 'unknown'}</strong>
          {status?.crmGmailOAuthRedirectUri && (
            <span className="block mt-1 font-mono text-[10px] break-all">{status.crmGmailOAuthRedirectUri}</span>
          )}
        </p>
        <ul className="text-xs text-blue-950 space-y-1 list-disc pl-4">
          <li>
            OAuth configured: {status?.crmGmailOAuthConfigured ? 'yes' : 'no'}
            {status?.crmGmailOAuthMissingEnv?.length ? ` (missing: ${status.crmGmailOAuthMissingEnv.join(', ')})` : ''}
          </li>
          <li>Connect offered to users: {status?.crmGmailConnectOffered ? 'yes' : 'no'}</li>
          <li>Verified (GOOGLE_OAUTH_VERIFIED): {status?.googleOAuthVerified ? 'yes' : 'no'}</li>
        </ul>
        <p className="text-xs text-blue-900 leading-relaxed">
          Before approval: set <code className="bg-white/80 px-1 rounded">GOOGLE_OAUTH_ALLOW_CONNECT=true</code> and
          add pilot emails as Test users in Google Cloud. After approval:{' '}
          <code className="bg-white/80 px-1 rounded">GOOGLE_OAUTH_VERIFIED=true</code>. See{' '}
          <strong>GOOGLE-OAUTH-VERIFICATION-RUNBOOK.md</strong> in the repo.
        </p>
      </section>

      <section className="mb-8 rounded-xl border-2 border-[#ffd4b8] bg-[#fff4ee] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#242424]">Team invite email (required for Team invites)</h2>
        <p className="text-xs text-[#FF773D] leading-relaxed">
          Production status:{' '}
          <strong>{status?.inviteEmailReady ? 'Connected' : 'Not connected'}</strong>
          {status?.inviteFromAddress ? ` · From ${status.inviteFromAddress}` : ''}
        </p>
        {!status?.inviteEmailReady && status?.inviteEmailHint && (
          <p className="text-xs text-amber-900">{status.inviteEmailHint}</p>
        )}
        <InviteEmailSetup />
      </section>

      <section className="mb-8 rounded-xl border-2 border-[#25D366]/50 bg-emerald-50/50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#242424]">WhatsApp Business API (bulk auto-send)</h2>
        <p className="text-xs text-[#14532d] leading-relaxed">
          Same setup as <strong>Data &amp; imports</strong>. Enables automatic marketing WhatsApp and pipeline bulk
          send for all customers.
        </p>
        <OrgWhatsAppCloudSetup scope="platform" />
      </section>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Customer-facing catalog</h2>
      <div className="space-y-4">
        {PARTNERS.map((partner) => (
          <PartnerCard key={partner.id} partner={partner} />
        ))}
      </div>
      </div>
    </div>
  )
}

function StatusPill({ label, on }) {
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full border font-medium ${
        on ? 'bg-green-50 text-green-800 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
      }`}
    >
      {label}: {on ? 'On' : 'Off'}
    </span>
  )
}

function PartnerCard({ partner }) {
  const isActive = partner.status === 'active'
  return (
    <div
      className={`rounded-xl border p-4 ${
        isActive ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{partner.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{partner.label}</h3>
            <span
              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {isActive ? 'Active' : 'Coming soon'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{partner.description}</p>
        </div>
      </div>
    </div>
  )
}
