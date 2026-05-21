import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PRODUCT } from '../../lib/productCopy'

const PARTNERS = [
  {
    id: 'connect-intel',
    label: 'Connect Intel database',
    icon: '📊',
    description: 'Built-in India B2B records plus companies your team imports via Admin.',
    status: 'active',
  },
  {
    id: 'ai',
    label: 'AI ranking & search',
    icon: '✨',
    description: 'Smart matching and lead scoring across your workspace.',
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
  const [recordCount, setRecordCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .getIntegrationStatus()
      .then((data) => {
        if (!cancelled && data.builtInRecords != null) {
          setRecordCount(data.builtInRecords)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-6 h-[calc(100vh-3.5rem)] overflow-y-auto max-w-3xl">
      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
        {PRODUCT.tagline} — search runs on the Connect Intel database today. Your organization can
        grow coverage by importing Excel lists in Admin. Additional data partners roll out with
        enterprise plans.
      </p>

      <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-8">
        <strong>Database active.</strong>{' '}
        {recordCount != null
          ? `${recordCount.toLocaleString()} built-in contacts loaded.`
          : 'Built-in India & global B2B records are available.'}{' '}
        Use <strong>Find people</strong> to search and save lists.
      </div>

      <div className="space-y-4">
        {PARTNERS.map((partner) => (
          <PartnerCard key={partner.id} partner={partner} />
        ))}
      </div>
    </div>
  )
}

function PartnerCard({ partner }) {
  const isActive = partner.status === 'active'
  const badge = isActive ? 'Included' : 'Coming soon'

  return (
    <div
      className={`flex items-start gap-4 p-5 rounded-xl border ${
        isActive ? 'border-[#ffcb2b]/40 bg-[#fffbeb]' : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
          isActive ? 'bg-[#ffcb2b]' : 'bg-gray-100'
        }`}
      >
        {partner.icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900">{partner.label}</h3>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {badge}
          </span>
        </div>
        <p className="text-sm text-gray-600">{partner.description}</p>
      </div>
    </div>
  )
}
