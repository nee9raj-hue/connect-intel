import { PROVIDERS } from '../../lib/searchService'

export default function IntegrationsPanel() {
  return (
    <div className="p-6 h-[calc(100vh-3.5rem)] overflow-y-auto max-w-3xl">
      <p className="text-sm text-gray-600 mb-8 leading-relaxed">
        Connect Intel uses multiple data sources to find and enrich leads. Claude AI powers search
        today; additional data providers can be connected as you scale.
      </p>

      <div className="space-y-4">
        {Object.values(PROVIDERS).map((provider) => (
          <IntegrationCard key={provider.id} provider={provider} />
        ))}
      </div>

      <div className="mt-8 p-5 bg-amber-50 border border-amber-200 rounded-xl">
        <h4 className="font-semibold text-amber-900 mb-1">Claude API setup</h4>
        <p className="text-sm text-amber-800 leading-relaxed">
          To enable live AI search, add your Anthropic API key to a backend proxy (never expose keys
          in the browser). The search service in <code className="bg-amber-100 px-1 rounded">src/lib/searchService.js</code> is
          ready to swap mock data for real Claude responses.
        </p>
      </div>
    </div>
  )
}

function IntegrationCard({ provider }) {
  const isActive = provider.status === 'active'
  return (
    <div
      className={`flex items-start gap-4 p-5 rounded-xl border ${
        isActive ? 'border-apollo-yellow bg-apollo-yellow/5' : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
          isActive ? 'bg-apollo-yellow' : 'bg-gray-100'
        }`}
      >
        {provider.id === 'claude' ? '🤖' : provider.id === 'apollo' ? '🚀' : '✉️'}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900">{provider.label}</h3>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isActive ? 'Active' : 'Coming soon'}
          </span>
        </div>
        <p className="text-sm text-gray-600">{provider.description}</p>
        {isActive && (
          <p className="text-xs text-green-700 mt-2 font-medium">✓ Currently powering lead search</p>
        )}
      </div>
      {!isActive && (
        <button
          disabled
          className="px-3 py-1.5 text-xs font-semibold text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed"
        >
          Connect
        </button>
      )}
    </div>
  )
}
