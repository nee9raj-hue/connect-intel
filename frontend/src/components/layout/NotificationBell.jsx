import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { formatDateTime } from '../../lib/crmUiConstants'
import { getNotificationTarget } from '../../lib/notificationNavigation'

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
  'team-notes': 'Notes',
  'team-tasks': 'Tasks',
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
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
      >
        <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold">
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
          <div className="absolute right-0 top-full mt-2 z-50 w-[min(100vw-2rem,360px)] max-h-[min(70vh,420px)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              {sorted.some((n) => n.unread) && (
                <button
                  type="button"
                  onClick={() => markAllNotificationsRead()}
                  className="text-[11px] font-medium text-[#8a6600] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {sorted.length === 0 ? (
                <p className="text-xs text-gray-500 px-3 py-6 text-center">
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
                          className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-[#fffbeb] focus:bg-[#fffbeb] focus:outline-none ${
                            item.unread ? 'bg-[#fffef5]' : 'opacity-90'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-[#8a6600]">
                              {TYPE_LABELS[item.type] || item.type}
                            </span>
                            {item.unread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ffcb2b]" aria-hidden />
                            )}
                          </div>
                          <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">{item.body}</p>
                          <p className="text-[10px] text-[#8a6600] mt-1 font-medium">Open in {where} →</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(item.createdAt)}</p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <p className="text-[10px] text-gray-400 px-3 py-2 border-t border-gray-100">
              Opens mark as read · click to jump to the item
            </p>
          </div>
        </>
      )}
    </div>
  )
}
