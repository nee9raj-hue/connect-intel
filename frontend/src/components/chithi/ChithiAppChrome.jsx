import ChithiMenuIcon from '../ui/ChithiMenuIcon'
import { ChevronLeftIcon } from '../ui/icons'

const TABS = [
  { id: 'chat', label: 'Chat', tab: null },
  { id: 'tasks', label: 'Tasks', tab: 'tasks' },
  { id: 'meetings', label: 'Meetings', tab: 'meetings' },
]

export default function ChithiAppChrome({
  view = 'chat',
  onNavigate,
  chithiUnread,
  channelLabel,
  mobileScreen = null,
  onMobileBack,
  activeChannelType,
}) {
  const unread = chithiUnread?.total || 0
  const isMobileList = mobileScreen === 'list'
  const isMobileChat = mobileScreen === 'chat'

  const channelTitle =
    view === 'chat' && channelLabel
      ? activeChannelType === 'dm'
        ? String(channelLabel)
        : `#${String(channelLabel).replace(/^#/, '')}`
      : null

  const subtitle =
    view === 'tasks'
      ? 'Team tasks'
      : view === 'meetings'
        ? 'Meetings'
        : isMobileChat
          ? activeChannelType === 'dm'
            ? 'Direct message'
            : 'Channel'
          : 'Team workspace'

  const tabsNav = (
    <nav className="chithi-app__tabs shrink-0 flex items-center gap-0.5 rounded-xl bg-[#f0f3f6] p-0.5" aria-label="Chithi sections">
      {TABS.map((t) => {
        const active =
          (t.id === 'chat' && view === 'chat') ||
          (t.id === 'tasks' && view === 'tasks') ||
          (t.id === 'meetings' && view === 'meetings')
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onNavigate?.('chithi', t.tab ? { tab: t.tab } : {})}
            className={`chithi-app__tab px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              active ? 'bg-white text-[#17191c] shadow-sm' : 'text-[#6b7785] hover:text-[#17191c]'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {t.label}
          </button>
        )
      })}
    </nav>
  )

  if (mobileScreen) {
    return (
      <header className="chithi-app__header chithi-app__header--mobile shrink-0 flex flex-col gap-2 px-3 py-2.5 border-b border-[#e8ecf0] bg-white">
        <div className="flex items-center gap-2 w-full min-w-0">
          <button
            type="button"
            onClick={isMobileChat ? onMobileBack : () => onNavigate?.('overview')}
            className="shrink-0 rounded-xl border border-[#e5e9ee] p-2 text-[#536072]"
            aria-label={isMobileChat ? 'Back to channels' : 'Back to CRM'}
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isMobileList && <ChithiMenuIcon onLight className="w-7 h-7 shrink-0" />}
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-[#17191c] tracking-[-0.02em] truncate">
                {isMobileChat ? channelTitle || 'Chat' : 'Chithi'}
              </h1>
              <p className="text-[10px] text-[#6b7785] truncate">{subtitle}</p>
            </div>
          </div>

          {unread > 0 && (
            <span className="shrink-0 text-[10px] font-bold rounded-full bg-[#ff7a59] text-white px-2 py-0.5 tabular-nums">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>

        {isMobileList && <div className="w-full">{tabsNav}</div>}
      </header>
    )
  }

  return (
    <header className="chithi-app__header shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-[#e8ecf0] bg-white">
      <button
        type="button"
        onClick={() => onNavigate?.('overview')}
        className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-[#e5e9ee] bg-[#f7f9fb] px-2.5 py-1.5 text-[11px] font-semibold text-[#536072] hover:bg-[#eef2f6] transition-colors"
        title="Back to Connect Intel CRM"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        <span>CRM</span>
      </button>

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <ChithiMenuIcon onLight className="w-8 h-8 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-[#17191c] tracking-[-0.02em] truncate">Chithi</h1>
          <p className="text-[10px] text-[#6b7785] truncate">
            {view === 'tasks'
              ? 'Team tasks'
              : view === 'meetings'
                ? 'Meetings'
                : channelLabel
                  ? `#${String(channelLabel).replace(/^#/, '')}`
                  : 'Team workspace'}
          </p>
        </div>
      </div>

      {unread > 0 && (
        <span className="shrink-0 text-[10px] font-bold rounded-full bg-[#ff7a59] text-white px-2 py-0.5 tabular-nums">
          {unread > 99 ? '99+' : unread}
        </span>
      )}

      {tabsNav}
    </header>
  )
}
