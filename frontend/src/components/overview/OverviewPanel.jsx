import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getVisiblePipelineColumns } from '../../lib/crmConstants'
import { QUICK_NAV_TILES, countPipelineByStatus, countUpcomingFromLeads, navTargetToOptions } from '../../lib/navConfig'
import { formatDateTime } from '../../lib/crmUiConstants'
import { withTimeout } from '../../lib/fetchWithTimeout'

const ICONS = {
  pipeline: '◎',
  spark: '✦',
  mail: '✉',
  people: '👤',
  calendar: '📅',
  log: '📋',
  note: '📝',
  task: '✓',
}

export default function OverviewPanel({ onNavigate, isActive = true }) {
  const {
    user,
    savedLeads,
    searchHistory,
    unreadNotificationCount,
    notifications,
    teamMembers,
  } = useApp()

  const [marketingSummary, setMarketingSummary] = useState(null)
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [loadingExtras, setLoadingExtras] = useState(true)

  const pipelineCounts = useMemo(() => countPipelineByStatus(savedLeads), [savedLeads])
  const columns = useMemo(() => getVisiblePipelineColumns(user), [user])
  const upcomingLocal = useMemo(() => countUpcomingFromLeads(savedLeads), [savedLeads])

  const replied = savedLeads.filter((l) => l.crm?.responseReceived).length
  const followUpDue = savedLeads.filter((l) => {
    const at = l.crm?.nextFollowUpAt
    return at && new Date(at).getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000
  }).length

  const loadExtras = useCallback(async () => {
    setLoadingExtras(true)
    try {
      const from = new Date()
      const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      const q = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      }).toString()
      const [mkt, cal] = await Promise.allSettled([
        withTimeout(api.getMarketingOverview(), 20_000),
        withTimeout(api.getCrmCalendar(q, { silent: true }), 20_000),
      ])
      if (mkt.status === 'fulfilled') setMarketingSummary(mkt.value.summary || null)
      if (cal.status === 'fulfilled') {
        const now = Date.now()
        const events = (cal.value.events || [])
          .filter((e) => new Date(e.scheduledAt).getTime() >= now)
          .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
          .slice(0, 6)
        setUpcomingEvents(events)
      }
    } catch {
      // keep local fallbacks
    } finally {
      setLoadingExtras(false)
    }
  }, [])

  useEffect(() => {
    if (!isActive) return undefined
    const timer = setTimeout(() => loadExtras(), 80)
    return () => clearTimeout(timer)
  }, [loadExtras, isActive])

  const go = (target) => onNavigate?.(target.panel, navTargetToOptions(target))

  const quickTiles = useMemo(() => {
    const isCompany = user?.accountType === 'company'
    return QUICK_NAV_TILES.filter((t) => {
      if (t.panel === 'team-notes' || t.panel === 'team-tasks') return isCompany
      return true
    })
  }, [user?.accountType])

  const recentNotifs = notifications.filter((n) => n.unread).slice(0, 5)

  return (
    <div className="panel-shell panel-scroll-page bg-[#f6f7f9]">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 max-md:block md:px-6 md:pt-6 md:pb-0 md:border-0 md:bg-transparent">
        <h1 className="text-base md:text-lg font-semibold text-gray-900">Home</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} — your CRM at a glance
        </p>
      </header>

      <div className="panel-body-scroll p-4 md:p-6 max-md:pt-3 space-y-5 md:space-y-6 w-full">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            {
              label: 'Pipeline leads',
              value: savedLeads.length,
              hint: `${replied} replied`,
              onClick: () => go({ panel: 'pipeline', status: 'all' }),
            },
            {
              label: 'Follow-up due',
              value: followUpDue,
              hint: 'Next 7 days',
              onClick: () => go({ panel: 'pipeline', status: 'follow_up' }),
            },
            {
              label: 'Upcoming',
              value: upcomingLocal || upcomingEvents.length,
              hint: 'Meetings & tasks',
              onClick: () => go({ panel: 'crm-calendar', upcomingOnly: true }),
            },
            {
              label: 'Credits',
              value: `₹${((user?.creditsPaise ?? 0) / 100).toFixed(0)}`,
              hint: `${user?.searchesLeft ?? 0} AI searches`,
              onClick: () => go({ panel: 'search' }),
            },
          ].map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={kpi.onClick}
              className="text-left bg-white rounded-xl border border-gray-200 p-4 md:p-5 hover:border-[#ffcb2b] hover:shadow-sm transition-all"
            >
              <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-500">
                {kpi.label}
              </p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1 tabular-nums">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-1">{kpi.hint}</p>
            </button>
          ))}
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Jump to</h2>
          <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3">
            {quickTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => go(tile)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 bg-white hover:bg-[#fffbeb] hover:border-[#fde68a] transition-colors"
                title={tile.desc}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {ICONS[tile.icon] || '→'}
                </span>
                <span className="text-[10px] font-semibold text-gray-800 text-center leading-tight">
                  {tile.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-4">
          <section className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Pipeline by stage</h3>
              <button
                type="button"
                onClick={() => go({ panel: 'pipeline', status: 'all' })}
                className="text-xs font-semibold text-[#5b4a00] hover:underline"
              >
                Open pipeline
              </button>
            </div>
            <div className="space-y-2">
              {columns.map((col) => {
                const count = pipelineCounts[col.id] || 0
                const pct = pipelineCounts.all ? Math.round((count / pipelineCounts.all) * 100) : 0
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => go({ panel: 'pipeline', status: col.id })}
                    className="w-full flex items-center gap-3 group"
                  >
                    <span className="text-xs text-gray-600 w-20 text-left shrink-0 group-hover:text-gray-900">
                      {col.label}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#ffcb2b] rounded-full transition-all"
                        style={{ width: `${Math.max(pct, count ? 8 : 0)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-8 text-right tabular-nums">{count}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Marketing</h3>
              <button
                type="button"
                onClick={() => go({ panel: 'marketing', tab: 'reports' })}
                className="text-xs font-semibold text-[#5b4a00] hover:underline"
              >
                Reports
              </button>
            </div>
            {loadingExtras ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : marketingSummary ? (
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex justify-between">
                  <span>Campaigns</span>
                  <span className="font-semibold tabular-nums">{marketingSummary.campaigns}</span>
                </li>
                <li className="flex justify-between">
                  <span>Sent</span>
                  <span className="font-semibold tabular-nums">{marketingSummary.sent}</span>
                </li>
                <li className="flex justify-between">
                  <span>Opens</span>
                  <span className="font-semibold tabular-nums">{marketingSummary.opens}</span>
                </li>
                <li className="flex justify-between">
                  <span>Clicks</span>
                  <span className="font-semibold tabular-nums">{marketingSummary.clicks}</span>
                </li>
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No campaigns yet.</p>
            )}
            <button
              type="button"
              onClick={() => go({ panel: 'marketing', tab: 'campaigns' })}
              className="mt-3 text-xs font-semibold w-full py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Create campaign
            </button>
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Upcoming meetings & tasks</h3>
              <button
                type="button"
                onClick={() => go({ panel: 'crm-calendar', upcomingOnly: true })}
                className="text-xs font-semibold text-[#5b4a00] hover:underline"
              >
                View all
              </button>
            </div>
            {loadingExtras ? (
              <p className="text-xs text-gray-400">Loading calendar…</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing scheduled — add from Pipeline.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => go({ panel: 'crm-calendar', upcomingOnly: true })}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {ev.leadName} · {formatDateTime(ev.scheduledAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Notifications
                {unreadNotificationCount > 0 && (
                  <span className="ml-2 text-[10px] font-bold bg-[#ffcb2b] text-[#242424] px-1.5 py-0.5 rounded">
                    {unreadNotificationCount}
                  </span>
                )}
              </h3>
            </div>
            {recentNotifs.length === 0 ? (
              <p className="text-sm text-gray-500">You are all caught up.</p>
            ) : (
              <ul className="space-y-2">
                {recentNotifs.map((n) => (
                  <li key={n.id} className="text-xs text-gray-700 border-b border-gray-50 pb-2 last:border-0">
                    <p className="font-medium text-gray-900">{n.title}</p>
                    <p className="text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent AI searches</h3>
            {searchHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No searches yet.</p>
            ) : (
              <ul className="space-y-2">
                {searchHistory.slice(0, 4).map((h, i) => (
                  <li key={i} className="flex justify-between gap-2 text-sm border-b border-gray-50 pb-2">
                    <span className="text-gray-800 truncate">{formatFilters(h.filters)}</span>
                    <span className="text-xs font-bold text-gray-500 shrink-0">{h.count} leads</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => go({ panel: 'search' })}
              className="mt-3 text-xs font-semibold text-[#5b4a00] hover:underline"
            >
              New search
            </button>
          </section>

          {user?.accountType === 'company' && (
            <section className="bg-white rounded-xl border border-teal-200/50 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Active customers</h3>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Track first shipment and repeat loads. Import ERP/shipment files by mobile number.
              </p>
              <button
                type="button"
                onClick={() => go({ panel: 'active-customers' })}
                className="text-xs font-semibold px-3 py-2 bg-teal-700 text-white rounded-lg"
              >
                Active customers dashboard
              </button>
            </section>
          )}

          {user?.isOrgAdmin && user?.accountType === 'company' && (
            <section className="bg-white rounded-xl border border-[#25D366]/30 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">WhatsApp Business API</h3>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                {user?.whatsappAutoSendReady
                  ? 'Automatic bulk WhatsApp is connected for your company.'
                  : 'Connect Meta API credentials to send marketing and pipeline WhatsApp without opening the app.'}
              </p>
              <button
                type="button"
                onClick={() => go({ panel: 'whatsapp-settings' })}
                className="text-xs font-semibold px-3 py-2 bg-[#25D366] text-white rounded-lg"
              >
                {user?.whatsappAutoSendReady ? 'WhatsApp API settings' : 'Set up WhatsApp API'}
              </button>
            </section>
          )}

          {user?.accountType === 'company' && teamMembers.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Team</h3>
              <ul className="space-y-1">
                {teamMembers.slice(0, 6).map((m) => (
                  <li key={m.userId} className="text-sm text-gray-700 flex justify-between">
                    <span>{m.name}</span>
                    <span className="text-xs text-gray-400">{m.orgRole === 'org_admin' ? 'Admin' : 'Member'}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => go({ panel: 'team' })}
                className="mt-3 text-xs font-semibold text-[#5b4a00] hover:underline"
              >
                Team settings
              </button>
            </section>
          )}
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
