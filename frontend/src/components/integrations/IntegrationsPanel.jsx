import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PROVIDERS } from '../../lib/providers'

export default function IntegrationsPanel() {
  const [status, setStatus] = useState({ apollo: false, claude: false })

  useEffect(() => {
    let cancelled = false
    api
      .getIntegrationStatus()
      .then((data) => {
        if (!cancelled) setStatus(data.providers || {})
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-6 h-[calc(100vh-3.5rem)] overflow-y-auto max-w-3xl">
      <p className="text-sm text-gray-600 mb-8 leading-relaxed">
        Connect Intel searches imported data first, then Apollo.io (when configured), then Claude AI.
        Unlock uses trial credits; Apollo leads call Apollo People Enrichment for email.
      </p>

      <div className="space-y-4">
        {Object.values(PROVIDERS).map((provider) => (
          <IntegrationCard
            key={provider.id}
            provider={provider}
            isLive={
              provider.id === 'apollo'
                ? status.apollo
                : provider.id === 'claude'
                  ? status.claude
                  : false
            }
          />
        ))}
      </div>
    </div>
  )
}

function IntegrationCard({ provider, isLive }) {
  const isActive = provider.id === 'claude' ? isLive : provider.id === 'apollo' ? isLive : false
  const badge = isLive ? 'Active' : 'Not configured'

  return (
    <div
      className={`flex items-start gap-4 p-5 rounded-xl border ${
        isLive ? 'border-apollo-yellow bg-apollo-yellow/5' : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
          isLive ? 'bg-apollo-yellow' : 'bg-gray-100'
        }`}
      >
        {provider.id === 'claude' ? '🤖' : provider.id === 'apollo' ? '🚀' : '✉️'}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900">{provider.label}</h3>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {badge}
          </span>
        </div>
        <p className="text-sm text-gray-600">{provider.description}</p>
        {provider.id === 'apollo' && isLive && (
          <p className="text-xs text-green-700 mt-2 font-medium">
            ✓ People API Search + enrichment on unlock
          </p>
        )}
        {provider.id === 'apollo' && !isLive && (
          <p className="text-xs text-gray-500 mt-2">
            Add <code className="bg-gray-100 px-1 rounded">APOLLO_API_KEY</code> on Vercel — see
            APOLLO-SETUP.md
          </p>
        )}
        {provider.id === 'claude' && isLive && (
          <p className="text-xs text-green-700 mt-2 font-medium">✓ Fallback AI search enabled</p>
        )}
      </div>
    </div>
  )
}
