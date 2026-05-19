import { useApp } from '../../context/AppContext'

export default function OverviewPanel({ onNavigate }) {
  const { user, savedLeads, searchHistory } = useApp()

  return (
    <div className="p-6 overflow-y-auto h-[calc(100vh-3.5rem)]">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Searches this month', value: searchHistory.length, change: '+2 this week' },
          { label: 'Leads found', value: searchHistory.reduce((s, h) => s + h.count, 0), change: 'Last 7 days' },
          { label: 'Saved leads', value: savedLeads.length, change: 'In your lists' },
          { label: 'Searches left', value: user?.searchesLeft ?? 25, change: 'Free plan' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {kpi.label}
            </div>
            <div className="text-3xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-1">{kpi.change}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Recent searches</h3>
          {searchHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No searches yet — start finding leads</p>
          ) : (
            <ul className="space-y-3">
              {searchHistory.slice(0, 5).map((h, i) => (
                <li key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {formatFilters(h.filters)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(h.at).toLocaleString()}
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-apollo-yellow/20 text-apollo-dark px-2 py-1 rounded">
                    {h.count} leads
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Quick actions</h3>
          <div className="space-y-2">
            {[
              { label: '🔍 New people search', panel: 'search' },
              { label: '★ View saved leads', panel: 'saved' },
              { label: '⚡ Manage integrations', panel: 'integrations' },
            ].map((action) => (
              <button
                key={action.panel}
                onClick={() => onNavigate?.(action.panel)}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-apollo-yellow/10 hover:text-apollo-dark border border-transparent hover:border-apollo-yellow/30 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatFilters(f) {
  const parts = []
  if (f.keywords) parts.push(`"${f.keywords}"`)
  if (f.jobTitles?.length) parts.push(f.jobTitles.slice(0, 2).join(', '))
  if (f.industries?.length) parts.push(f.industries[0])
  return parts.join(' · ') || 'All prospects'
}
