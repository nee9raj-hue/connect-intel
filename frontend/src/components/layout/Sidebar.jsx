import { useApp } from '../../context/AppContext'

const NAV = [
  { id: 'overview', label: 'Overview', icon: '⊞' },
  { id: 'search', label: 'People', icon: '👥' },
  { id: 'saved', label: 'Saved', icon: '★' },
  { id: 'integrations', label: 'Integrations', icon: '⚡' },
]

export default function Sidebar({ active, onNavigate }) {
  const { user, logout, savedLeads } = useApp()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-ci-sidebar flex flex-col z-40">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-ci-yellow flex items-center justify-center text-ci-dark font-bold text-xs">
            CI
          </div>
          <div>
            <div className="font-bold text-white text-sm">Connect Intel</div>
            <div className="text-[10px] text-gray-500">Lead platform</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
              active === item.id
                ? 'bg-white/12 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
          >
            <span className="w-5 text-center text-[14px] opacity-90">{item.icon}</span>
            {item.label}
            {item.id === 'saved' && savedLeads.length > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-ci-yellow text-ci-dark px-1.5 py-0.5 rounded">
                {savedLeads.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-2">
          {user?.picture ? (
            <img
              src={user.picture}
              alt=""
              className="w-8 h-8 rounded-md object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-md bg-ci-yellow/25 text-ci-yellow flex items-center justify-center text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
            <div className="text-[10px] text-gray-500 truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full mt-1 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 text-left rounded-md hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
