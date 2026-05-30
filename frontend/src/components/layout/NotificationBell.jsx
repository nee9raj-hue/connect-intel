import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { formatDateTime } from '../../lib/crmUiConstants'
import { getNotificationTarget } from '../../lib/notificationNavigation'
import { BellIcon } from '../ui/icons'

const TYPE_LABELS = {
  assignment: 'Assignment',
  reply: 'Reply',
  meeting: 'Calendar',
  task: 'Task',
  follow_up: 'Follow-up',
  team_note: 'Team note',
  team_task: 'Team task',
}

const PANEL_LABELS = {
  pipeline: 'Pipeline',
  'crm-calendar': 'Calendar',
  overview: 'Overview',
  chithi: 'Chithi',
  'team-hub': 'Chithi',
  'team-notes': 'Chithi',
  'team-tasks': 'Chithi',
}

export default function NotificationBell() {
  const {
    notifications,
    unreadNotificationCount,
    markAllNotificationsRead,
    navigateToNotification,
    markNotificationsPanelOpened,
  } = useApp()
  const [open, setOpen] = useState(false)

  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    [notifications]
  )

  useEffect(() => {
    if (open) markNotificationsPanelOpened()
  }, [open, markNotificationsPanelOpened])

  const toggleOpen = () => setOpen((v) => !v)

  const handleClick = (item) => {
    navigateToNotification(item)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[#d7dde5] bg-white text-[#4f5d70] transition-colors hover:bg-[#f5f7fa] hover:text-[#17191c]"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
      >
        <BellIcon className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#17191c] px-1 text-xs font-bold text-white">
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(70vh,420px)] w-[min(100vw-2rem,360px)] flex-col overflow-hidden rounded-[20px] border border-[#d7dde5] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.16)]">
            <div className="flex items-center justify-between border-b border-[#eef1f4] px-3.5 py-3">
              <p className="text-sm font-semibold tracking-[-0.02em] text-[#17191c]">Notifications</p>
              {sorted.some((n) => n.unread) && (
                <button
                  type="button"
                  onClick={() => markAllNotificationsRead()}
                  className="text-xs font-medium text-[#536072] hover:text-[#17191c] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {sorted.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-[#6d7785]">
                  You&apos;re up to date. Updates appear here when leads are assigned, replies arrive, or
                  meetings are due.
                </p>
              ) : (
                <ul>
                  {sorted.map((item) => {
                    const target = getNotificationTarget(item)
                    const where = target.leadId
                      ? `${PANEL_LABELS[target.panel] || target.panel} · lead`
                      : PANEL_LABELS[target.panel] || target.panel

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleClick(item)}
                          className={`w-full border-b border-[#f3f5f7] px-3.5 py-3 text-left focus:outline-none hover:bg-[#f7f9fb] focus:bg-[#f7f9fb] ${
                            item.unread ? 'bg-[#fbfcfd]' : 'opacity-95'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#5f6d80]">
                              {TYPE_LABELS[item.type] || item.type}
                            </span>
                            {item.unread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#17191c]" aria-hidden />
                            )}
                          </div>
                          <p className="text-xs font-semibold tracking-[-0.02em] text-[#17191c]">
                            {item.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-[#5f6d80]">{item.body}</p>
                          <p className="mt-1 text-xs font-medium text-[#202938]">Open in {where} →</p>
                          <p className="mt-0.5 text-xs text-[#9aa3ad]">{formatDateTime(item.createdAt)}</p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <p className="border-t border-[#eef1f4] px-3.5 py-2 text-xs text-[#98a1ac]">
              Opens mark as read · click to jump to the item
            </p>
          </div>
        </>
      )}
    </div>
  )
}
