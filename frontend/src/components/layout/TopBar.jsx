const TITLES = {
  overview: ['Overview', 'Your prospecting summary'],
  search: ['People Search', 'Find B2B leads with AI-powered filters'],
  saved: ['Saved Leads', 'Your saved prospect lists'],
  integrations: ['Integrations', 'Connect data providers'],
}

export default function TopBar({ activePanel }) {
  const [title, sub] = TITLES[activePanel] || TITLES.search

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Claude AI active
        </span>
        <button className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          🔔
        </button>
      </div>
    </header>
  )
}
