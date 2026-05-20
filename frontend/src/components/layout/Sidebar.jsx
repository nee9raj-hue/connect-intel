import { useApp } from '../../context/AppContext'

const PROSPECT = [
  { id: 'search', label: 'People', icon: PeopleIcon },
  { id: 'saved', label: 'Lists', icon: ListIcon },
]

const BOTTOM = [
  { id: 'overview', label: 'Home', icon: HomeIcon },
  { id: 'integrations', label: 'Integrations', icon: BoltIcon },
]

export default function Sidebar({ active, onNavigate }) {
  const { user, logout, savedLeads } = useApp()

  return (
    <aside className="w-[220px] shrink-0 h-full bg-white border-r border-gray-200 flex flex-col">
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-gray-100 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#242424] flex items-center justify-center">
          <span className="text-[#ffcb2b] font-bold text-xs">CI</span>
        </div>
        <span className="font-semibold text-[15px] text-gray-900">Connect Intel</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Prospect & enrich
        </p>
        {PROSPECT.map((item) => (
          <NavBtn
            key={item.id}
            item={item}
            active={active === item.id}
            onClick={() => onNavigate(item.id)}
            badge={item.id === 'saved' && savedLeads.length > 0 ? savedLeads.length : null}
          />
        ))}

        <p className="px-3 mt-5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Platform
        </p>
        {BOTTOM.map((item) => (
          <NavBtn
            key={item.id}
            item={item}
            active={active === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
        {user?.role === 'admin' && (
          <NavBtn
            item={{ id: 'admin', label: 'Admin', icon: ShieldIcon }}
            active={active === 'admin'}
            onClick={() => onNavigate('admin')}
          />
        )}

        <div className="mx-2 mt-4 p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a]">
          <p className="text-xs font-semibold text-gray-800">Claude AI search</p>
          <p className="text-[10px] text-gray-600 mt-1 leading-snug">
            Apollo.io & Hunter.io plug in here later for verified data.
          </p>
        </div>
      </nav>

      <div className="shrink-0 border-t border-gray-100 p-3">
        <div className="flex items-center gap-2 px-1">
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
              {user?.name?.[0] || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            <p className="text-[10px] text-[#8a6600] truncate mt-0.5">
              Credits: Rs {((user?.creditsPaise ?? 0) / 100).toFixed(0)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-2 w-full text-left text-xs text-gray-500 hover:text-gray-800 px-1 py-1"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}

function NavBtn({ item, active, onClick, badge }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium mb-0.5 transition-colors ${
        active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-gray-500'}`} />
      <span className="flex-1 text-left">{item.label}</span>
      {badge != null && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}
function PeopleIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function ListIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}
function BoltIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}
function ShieldIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z"
      />
    </svg>
  )
}
