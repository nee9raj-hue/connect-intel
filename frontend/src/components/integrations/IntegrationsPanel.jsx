import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { PRODUCT } from '../../lib/productCopy'
import InviteEmailSetup from '../team/InviteEmailSetup'

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
    label: 'Work Gmail',
    icon: '✉️',
    description: 'Send outreach from your inbox — connect under Team or on any lead’s Email tab.',
    status: 'active',
  },
  {
    id: 'crm',
    label: 'CRM sync',
    icon: '🔗',
    description: 'Salesforce, HubSpot, and pipeline tools — enterprise rollout.',
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
    return (
      <div className="p-6 h-[calc(100vh-3.5rem)] overflow-y-auto max-w-3xl">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Connected services</h1>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          {PRODUCT.tagline} Your workspace includes AI prospect search, pipeline CRM, and optional work
          Gmail for sending. Company admins manage team access and imports under <strong>Team</strong>.
        </p>
        <div className="space-y-4">
          {PARTNERS.filter((p) => p.status === 'active').map((partner) => (
            <PartnerCard key={partner.id} partner={partner} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-8">
          More data partners and CRM sync are on the roadmap for enterprise plans.
        </p>
      </div>
    )
  }

  const storageOk = status?.supabaseConnected
  const storageLabel = status?.storage === 'supabase' ? 'Supabase (persistent)' : 'Temporary (sqlite)'

  return (
    <div className="p-6 h-[calc(100vh-3.5rem)] overflow-y-auto max-w-3xl">
      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
        <strong>Platform operator view.</strong> Check Supabase, Perplexity, and Gemini env wiring on
        Vercel. Customer company admins import only their own pipeline under Team — master sheets go
        through Data & imports.
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
        <StatusPill label="Perplexity" on={status?.perplexity} />
        <StatusPill label="Gemini" on={status?.gemini} />
        <StatusPill label="Supabase env" on={status?.supabase} />
        <StatusPill label="Supabase live" on={status?.supabaseConnected} />
        <StatusPill label="Team invite email" on={status?.inviteEmailReady} />
      </div>

      <section className="mb-8 rounded-xl border-2 border-[#ffe48a] bg-[#fffbeb] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#242424]">Team invite email (required for Team invites)</h2>
        <p className="text-xs text-[#5b4a00] leading-relaxed">
          Production status:{' '}
          <strong>{status?.inviteEmailReady ? 'Connected' : 'Not connected'}</strong>
          {status?.inviteFromAddress ? ` · From ${status.inviteFromAddress}` : ''}
        </p>
        {!status?.inviteEmailReady && status?.inviteEmailHint && (
          <p className="text-xs text-amber-900">{status.inviteEmailHint}</p>
        )}
        <InviteEmailSetup />
      </section>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Customer-facing catalog</h2>
      <div className="space-y-4">
        {PARTNERS.map((partner) => (
          <PartnerCard key={partner.id} partner={partner} />
        ))}
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
