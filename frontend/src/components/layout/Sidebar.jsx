import { useApp } from '../../context/AppContext'

const PROSPECT = [
  { id: 'search', label: 'AI prospect search', icon: SparkIcon },
  { id: 'saved', label: 'Saved leads', icon: ListIcon },
]

const CRM = [
  { id: 'pipeline', label: 'Pipeline', icon: PipelineIcon },
  { id: 'bulk-email', label: 'Bulk email', icon: MailIcon },
  { id: 'crm-dashboard', label: 'Team dashboard', icon: ChartIcon },
  { id: 'crm-log', label: 'Activity log', icon: LogIcon },
  { id: 'crm-calendar', label: 'Calendar', icon: CalendarIcon },
]

const CUSTOMER_PLATFORM = [
  { id: 'overview', label: 'Home', icon: HomeIcon },
  { id: 'integrations', label: 'Integrations', icon: BoltIcon },
]

const OPERATOR_PLATFORM = [
  { id: 'admin', label: 'Data & imports', icon: DatabaseIcon },
  { id: 'integrations', label: 'System status', icon: BoltIcon },
]

export default function Sidebar({ active, onNavigate, mobileOpen, onMobileClose }) {
  const { user, logout, savedLeads } = useApp()
  const isOperator = Boolean(user?.isPlatformAdmin)
  const showTeam = user?.isOrgAdmin && user?.accountType === 'company' && !isOperator
  const orgName = isOperator ? 'Connect Intel' : user?.organizationName || 'Connect Intel'
  const orgSubtitle = isOperator
    ? 'Platform operator'
    : user?.accountType === 'company'
      ? 'Team workspace'
      : null

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`fixed md:static z-50 md:z-auto w-[260px] md:w-[220px] shrink-0 h-full bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-gray-100 shrink-0">
        {isOperator ? (
          <div className="w-8 h-8 rounded-lg bg-[#242424] flex items-center justify-center">
            <span className="text-[#ffcb2b] font-bold text-xs">CI</span>
          </div>
        ) : user?.organizationLogoUrl ? (
          <img src={user.organizationLogoUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[#242424] flex items-center justify-center">
            <span className="text-[#ffcb2b] font-bold text-xs">CI</span>
          </div>
        )}
        <div className="min-w-0">
          <span className="font-semibold text-[14px] text-gray-900 block truncate">{orgName}</span>
          {orgSubtitle && (
            <span className="text-[10px] text-gray-500 truncate block">{orgSubtitle}</span>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {isOperator ? (
          <>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a6600]">
              Platform backend
            </p>
            {OPERATOR_PLATFORM.map((item) => (
              <NavBtn
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
            <p className="px-3 mt-5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Preview as customer
            </p>
            {PROSPECT.map((item) => (
              <NavBtn
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => onNavigate(item.id)}
                muted
              />
            ))}
            {[...CRM, { id: 'bulk-email', label: 'Bulk email', icon: MailIcon }].map((item) => (
              <NavBtn
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => onNavigate(item.id)}
                muted
              />
            ))}
          </>
        ) : (
          <>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              CRM
            </p>
            {(user?.accountType === 'company' ? CRM : CRM.filter((i) => i.id !== 'crm-dashboard')).map(
              (item) => (
              <NavBtn
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => onNavigate(item.id)}
                badge={item.id === 'pipeline' && savedLeads.length > 0 ? savedLeads.length : null}
              />
            ))}

            <p className="px-3 mt-5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              AI prospecting
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

            {showTeam && (
              <NavBtn
                item={{ id: 'team', label: 'Team', icon: TeamIcon }}
                active={active === 'team'}
                onClick={() => onNavigate('team')}
              />
            )}

            <p className="px-3 mt-5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Platform
            </p>
            {CUSTOMER_PLATFORM.map((item) => (
              <NavBtn
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </>
        )}

        <div
          className={`mx-2 mt-4 p-3 rounded-lg border ${
            isOperator ? 'bg-gray-900 border-gray-800 text-white' : 'bg-[#fffbeb] border-[#fde68a]'
          }`}
        >
          <p className={`text-xs font-semibold ${isOperator ? 'text-[#ffcb2b]' : 'text-gray-800'}`}>
            {isOperator ? 'Master database' : 'CRM first, then AI'}
          </p>
          <p className={`text-[10px] mt-1 leading-snug ${isOperator ? 'text-gray-300' : 'text-gray-600'}`}>
            {isOperator
              ? 'Upload sheets here. All customers search this shared data.'
              : 'Build your pipeline first. Use AI prospect search when you need new leads.'}
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
              {isOperator
                ? 'Platform admin'
                : `${user?.accountType === 'company' ? 'Company' : 'Individual'} · Searches: ${user?.searchesLeft ?? 0}`}
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
    </>
  )
}

function NavBtn({ item, active, onClick, badge, muted = false }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium mb-0.5 transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : muted
            ? 'text-gray-500 hover:bg-gray-50'
            : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-gray-500'}`} />
      <span className="flex-1 text-left">{item.label}</span>
      {badge != null && (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function DatabaseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
      />
    </svg>
  )
}

function TeamIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
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
function PipelineIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
    </svg>
  )
}
function LogIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}
function CalendarIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

function MailIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  )
}

function ChartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function SparkIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
