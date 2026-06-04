import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { DEFAULT_THEME } from '../../lib/marketingEmailDesign'
import { formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import MarketingCreatorBadge from './MarketingCreatorBadge'

const PAGE_SIZE = 100

const FILTERS = [
  { id: 'all', label: 'All recipients' },
  { id: 'sent', label: 'Sent' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'opened', label: 'Opened' },
  { id: 'clicked', label: 'Clicked' },
  { id: 'bounced', label: 'Bounced' },
  { id: 'failed', label: 'Failed' },
  { id: 'unsubscribed', label: 'Unsubscribed' },
]

const STATUS_STYLES = {
  delivered: 'bg-slate-100 text-[#64748B] border-slate-200',
  bounced: 'bg-red-50 text-red-800 border-red-100',
  failed: 'bg-orange-50 text-orange-800 border-orange-100',
  pending: 'bg-gray-100 text-gray-700 border-gray-200',
  unsubscribed: 'bg-amber-50 text-amber-900 border-amber-100',
}

export function campaignToForm(campaign) {
  const steps = campaign?.steps || []
  const s0 = steps[0] || {}
  const s1 = steps[1]
  const base = String(campaign?.name || 'Campaign').trim()
  return {
    name: base.startsWith('Copy of ') ? base : `Copy of ${base}`,
    channel: campaign?.channel || 'email',
    listId: campaign?.listId || '',
    templateId: campaign?.templateId || '',
    subject: s0.subject || campaign?.subject || '',
    body: s0.body || campaign?.body || '',
    blocks: s0.blocks || campaign?.blocks || [],
    design: s0.design || campaign?.design || { ...DEFAULT_THEME },
    previewText: s0.previewText || campaign?.previewText || '',
    useSequence: steps.length > 1,
    step2Subject: s1?.subject || '',
    step2Body: s1?.body || '',
    step2Blocks: s1?.blocks || [],
    step2Design: s1?.design || { ...DEFAULT_THEME },
    step2PreviewText: s1?.previewText || '',
    step2Delay: s1?.delayDays ?? 3,
  }
}

function filterRecipients(rows, filter) {
  if (filter === 'sent')
    return rows.filter((r) => (r.sentCount || 0) > 0 || r.deliveryStatus === 'delivered')
  if (filter === 'delivered') return rows.filter((r) => r.deliveryStatus === 'delivered')
  if (filter === 'pending')
    return rows.filter((r) => r.deliveryStatus === 'pending' || (r.sentCount || 0) === 0)
  if (filter === 'opened') return rows.filter((r) => r.opens > 0)
  if (filter === 'clicked') return rows.filter((r) => r.clicks > 0)
  if (filter === 'bounced') return rows.filter((r) => r.deliveryStatus === 'bounced')
  if (filter === 'failed')
    return rows.filter(
      (r) => r.deliveryStatus === 'failed' || r.deliveryStatus === 'unsubscribed'
    )
  if (filter === 'unsubscribed') return rows.filter((r) => r.deliveryStatus === 'unsubscribed')
  return rows
}

function recipientEngagementLabel(row) {
  if (row.clicks > 0) return 'Clicked'
  if (row.opens > 0) return 'Opened'
  if (row.deliveryStatus === 'delivered' || (row.sentCount || 0) > 0) return 'Sent'
  if (row.deliveryStatus === 'bounced') return 'Bounced'
  if (row.deliveryStatus === 'failed') return 'Failed'
  if (row.deliveryStatus === 'unsubscribed') return 'Unsubscribed'
  return 'Pending'
}

function ReportOverlay({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="marketing-studio-popup-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`marketing-studio-popup ${wide ? 'marketing-report-popup' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="marketing-studio-popup-head">
          <h3 id="report-popup-title">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
        <div className="marketing-studio-popup-body">{children}</div>
      </div>
    </div>
  )
}

function KpiTile({ label, value, active, onClick, accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`marketing-report-kpi-tile ${active ? 'marketing-report-kpi-tile--active' : ''}`}
    >
      <span className="marketing-report-kpi-tile__label">{label}</span>
      <span className={`marketing-report-kpi-tile__value ${accent || ''}`}>{value}</span>
    </button>
  )
}

function WhatsAppRecipientRow({ row, busy, onOpenLead, onSent, autoSend }) {
  const statusClass = STATUS_STYLES[row.deliveryStatus] || STATUS_STYLES.pending
  const pending = row.deliveryStatus === 'pending' || (row.sentCount || 0) === 0
  const manualFallback = !autoSend && pending
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/90 align-top">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onOpenLead(row.leadId)}
          className="font-medium text-gray-900 hover:text-[#FF773D] hover:underline text-left"
        >
          {row.name || '—'}
        </button>
        {row.company && <p className="text-xs text-gray-500">{row.company}</p>}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600">{row.phone || '—'}</td>
      <td className="px-4 py-3">
        <p className="text-xs text-gray-700 line-clamp-3 max-w-md whitespace-pre-wrap">
          {row.whatsappMessage || '—'}
        </p>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded border ${statusClass}`}>
          {row.deliveryStatus === 'delivered' ? 'sent' : row.deliveryStatus}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          {manualFallback && row.whatsappUrl && (
            <a
              href={row.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-center"
            >
              Open WhatsApp
            </a>
          )}
          {manualFallback && row.enrollmentId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSent(row.enrollmentId)}
              className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Mark sent
            </button>
          )}
          {autoSend && row.lastError && (
            <span className="text-xs text-red-700 line-clamp-2">{row.lastError}</span>
          )}
          {autoSend && row.lastSentAt && (
            <span className="text-xs text-gray-500">Sent {formatDateTime(row.lastSentAt)}</span>
          )}
        </div>
      </td>
    </tr>
  )
}

function RecipientRow({ row, expanded, onToggle, onOpenLead }) {
  const statusClass = STATUS_STYLES[row.deliveryStatus] || STATUS_STYLES.pending
  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/90">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenLead(row.leadId)}
            className="font-medium text-gray-900 hover:text-[#FF773D] hover:underline text-left"
          >
            {row.name || '—'}
          </button>
          {row.title && <p className="text-xs text-gray-500">{row.title}</p>}
        </td>
        <td className="px-4 py-3 text-gray-600">{row.company || '—'}</td>
        <td className="px-4 py-3 text-gray-600 text-xs">{row.email}</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded border ${statusClass}`}>
            {recipientEngagementLabel(row)}
          </span>
          {row.deliveryStatus !== recipientEngagementLabel(row).toLowerCase() &&
            row.deliveryStatus !== 'delivered' && (
              <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{row.deliveryStatus}</p>
            )}
        </td>
        <td className="px-4 py-3 tabular-nums text-center">
          {row.opens > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              className="font-semibold text-[#FF773D] hover:underline"
            >
              {row.opens}
            </button>
          ) : (
            <span className="text-gray-300">0</span>
          )}
        </td>
        <td className="px-4 py-3 tabular-nums text-center">
          {row.clicks > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              className="font-semibold text-blue-700 hover:underline"
            >
              {row.clicks}
            </button>
          ) : (
            <span className="text-gray-300">0</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">
          {row.lastClickAt
            ? `Clicked ${formatDateTime(row.lastClickAt)}`
            : row.lastOpenAt
              ? `Opened ${formatDateTime(row.lastOpenAt)}`
              : row.lastSentAt
                ? `Sent ${formatDateTime(row.lastSentAt)}`
                : row.lastError
                  ? row.lastError.slice(0, 48)
                  : '—'}
        </td>
      </tr>
      {expanded && (row.clickUrls?.length > 0 || row.lastError) && (
        <tr className="bg-gray-50/80 border-b border-gray-100">
          <td colSpan={7} className="px-4 py-3 text-xs text-gray-600 space-y-1">
            {row.lastError && row.deliveryStatus !== 'delivered' && (
              <p>
                <span className="font-semibold text-gray-700">Error: </span>
                {row.lastError}
              </p>
            )}
            {row.clickUrls?.map((url) => (
              <p key={url} className="truncate">
                <span className="font-semibold text-gray-700">Link: </span>
                {url}
              </p>
            ))}
          </td>
        </tr>
      )}
    </>
  )
}

function KpiRecipientsPopup({
  title,
  filter,
  recipients,
  isWhatsApp,
  onClose,
  onShowInTable,
  onOpenLead,
}) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const filtered = useMemo(() => filterRecipients(recipients, filter), [recipients, filter])
  const shown = filtered.slice(0, visible)
  const hasMore = visible < filtered.length

  return (
    <ReportOverlay title={title} onClose={onClose}>
      <p className="text-xs text-gray-500 mb-3">
        {filtered.length} contact{filtered.length === 1 ? '' : 's'}
      </p>
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden max-h-[min(420px,50vh)] overflow-y-auto">
        {!shown.length ? (
          <li className="px-4 py-8 text-center text-sm text-gray-500">No contacts in this group.</li>
        ) : (
          shown.map((row) => (
            <li key={row.enrollmentId} className="px-3 py-2.5 flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => onOpenLead(row.leadId)}
                className="text-left min-w-0 flex-1"
              >
                <span className="text-sm font-medium text-gray-900 hover:underline">
                  {row.name || '—'}
                </span>
                <span className="block text-xs text-gray-500 truncate">
                  {isWhatsApp ? row.phone : row.email}
                  {row.company ? ` · ${row.company}` : ''}
                </span>
              </button>
              <span className="text-xs font-semibold uppercase text-gray-500 shrink-0">
                {row.deliveryStatus}
              </span>
            </li>
          ))
        )}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisible((n) => n + PAGE_SIZE)}
          className="mt-3 w-full text-xs font-semibold py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Load more ({filtered.length - visible} remaining)
        </button>
      )}
      <button
        type="button"
        onClick={() => onShowInTable(filter)}
        className="mt-3 w-full text-xs font-semibold py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
      >
        Show in recipient table
      </button>
    </ReportOverlay>
  )
}

function CampaignDetailReport({
  campaignId,
  campaignName,
  onClose,
  onNavigate,
  onDuplicate,
  busy,
}) {
  const { openPipelineLead, user } = useApp()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [search, setSearch] = useState('')
  const [waBusy, setWaBusy] = useState(false)
  const [listVisible, setListVisible] = useState(PAGE_SIZE)
  const [kpiPopup, setKpiPopup] = useState(null)
  const recipientsRef = useRef(null)
  const isWhatsApp = report?.campaign?.channel === 'whatsapp'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getMarketingCampaignReport(campaignId)
      setReport(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setListVisible(PAGE_SIZE)
  }, [filter, search])

  const goToLead = (leadId) => {
    if (!leadId) return
    onClose?.()
    onNavigate?.('pipeline')
    openPipelineLead(leadId, 'overview')
  }

  const markWhatsAppSent = async (enrollmentId) => {
    setWaBusy(true)
    try {
      await api.logMarketingWhatsAppSent(enrollmentId)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setWaBusy(false)
    }
  }

  const stats = report?.stats || {}
  const sentKpi = stats.recipientsSent ?? stats.sent ?? 0
  const allRecipients = report?.recipients || []
  const reportScopeHint =
    report?.reportScope === 'org_member'
      ? 'Org campaign — you see all recipients and engagement for this campaign.'
      : null

  const recipients = useMemo(() => {
    let rows = filterRecipients(allRecipients, filter)
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          r.company?.toLowerCase().includes(q)
      )
    }
    return rows
  }, [allRecipients, filter, search])

  const shownRecipients = recipients.slice(0, listVisible)
  const hasMoreRecipients = listVisible < recipients.length

  const showInTable = (nextFilter) => {
    setFilter(nextFilter)
    setKpiPopup(null)
    requestAnimationFrame(() => {
      recipientsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const openKpi = (nextFilter, label) => {
    setKpiPopup({ filter: nextFilter, label })
  }

  if (loading) {
    return <LoadingExperience message="Loading campaign report…" fill={false} className="py-16" />
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-700">{error}</p>
        <button type="button" onClick={onClose} className="mt-3 text-xs font-semibold underline">
          Close
        </button>
      </div>
    )
  }

  const filterLabel =
    filter === 'pending'
      ? 'Pending'
      : FILTERS.find((f) => f.id === filter)?.label || 'All recipients'

  return (
    <div className="space-y-4">
      {kpiPopup && (
        <KpiRecipientsPopup
          title={kpiPopup.label}
          filter={kpiPopup.filter}
          recipients={allRecipients}
          isWhatsApp={isWhatsApp}
          onClose={() => setKpiPopup(null)}
          onShowInTable={showInTable}
          onOpenLead={goToLead}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {campaignName || report?.campaign?.name}
            </h2>
            {report?.campaign?.createdByName && (
              <MarketingCreatorBadge
                name={report.campaign.createdByName}
                isOwn={report.campaign.createdByUserId === user?.id}
              />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">
            {report?.campaign?.status} · {isWhatsApp ? 'WhatsApp' : 'Email'} ·{' '}
            {report?.campaign?.type === 'sequence' ? 'Sequence' : 'One-shot'}
            {report?.campaign?.startedAt && ` · ${formatDateTime(report.campaign.startedAt)}`}
          </p>
          {!isWhatsApp && (
            <p className="text-xs text-[#516f90] mt-1 leading-relaxed max-w-2xl">
              {report?.reportScope === 'org_member'
                ? 'Team view: all org opens/clicks for your visible pipeline leads. Click a KPI to drill down, then expand a row for link activity.'
                : 'Click a KPI to filter recipients. Expand a row for delivery details and clicked links.'}
              {stats.sent > 0 && stats.uniqueOpens === 0 && stats.uniqueClicks === 0 && (
                <span className="block mt-1 text-amber-800">
                  Opens/clicks appear after recipients load images or click tracked links (some mail clients block
                  tracking).
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDuplicate?.(campaignId)}
            className="text-xs font-semibold px-3 py-2 bg-[#FF773D] text-[#242424] rounded-lg disabled:opacity-50"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={load}
            className="text-xs font-semibold px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div
        className={`grid gap-2 ${isWhatsApp ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-6'}`}
      >
        <KpiTile
          label="Enrolled"
          value={stats.enrolled ?? 0}
          active={filter === 'all' && !kpiPopup}
          onClick={() => openKpi('all', 'Enrolled')}
        />
        <KpiTile
          label="Sent"
          value={sentKpi}
          accent="text-[#FF773D]"
          active={filter === 'sent'}
          onClick={() => openKpi('sent', 'Sent')}
        />
        {!isWhatsApp && (
          <>
            <KpiTile
              label="Bounced"
              value={stats.bounced ?? 0}
              accent="text-red-700"
              active={filter === 'bounced'}
              onClick={() => openKpi('bounced', 'Bounced')}
            />
            <KpiTile
              label={`Opened${stats.openRate ? ` (${stats.openRate}%)` : ''}`}
              value={stats.uniqueOpens ?? 0}
              accent="text-[#FF773D]"
              active={filter === 'opened'}
              onClick={() => openKpi('opened', 'Opened')}
            />
            <KpiTile
              label={`Clicked${stats.clickRate ? ` (${stats.clickRate}%)` : ''}`}
              value={stats.uniqueClicks ?? 0}
              accent="text-blue-700"
              active={filter === 'clicked'}
              onClick={() => openKpi('clicked', 'Clicked')}
            />
            <KpiTile
              label="Failed"
              value={(stats.failed ?? 0) + (stats.unsubscribed ?? 0)}
              accent="text-orange-700"
              active={filter === 'failed'}
              onClick={() => openKpi('failed', 'Failed / unsubscribed')}
            />
          </>
        )}
        {isWhatsApp && (
          <>
            <KpiTile
              label="Pending"
              value={stats.pending ?? 0}
              active={filter === 'pending'}
              onClick={() => openKpi('pending', 'Pending')}
            />
            <KpiTile
              label="Failed"
              value={stats.failed ?? 0}
              accent="text-orange-700"
              active={filter === 'failed'}
              onClick={() => openKpi('failed', 'Failed')}
            />
          </>
        )}
      </div>

      <div
        ref={recipientsRef}
        className="bg-white border border-gray-200 rounded-xl overflow-hidden"
      >
        <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-700">{filterLabel}</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isWhatsApp ? 'Search…' : 'Search…'}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-40 sm:w-52"
          />
        </div>

        <div className="overflow-x-auto max-h-[min(440px,52vh)] overflow-y-auto">
          <table className={`w-full text-sm ${isWhatsApp ? 'min-w-[640px]' : 'min-w-[720px]'}`}>
            <thead className="sticky top-0 bg-gray-50 z-10">
              {isWhatsApp ? (
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-2 font-semibold">Contact</th>
                  <th className="px-4 py-2 font-semibold">Phone</th>
                  <th className="px-4 py-2 font-semibold">Message</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Actions</th>
                </tr>
              ) : (
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-2 font-semibold">Contact</th>
                  <th className="px-4 py-2 font-semibold">Company</th>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold text-center">Opens</th>
                  <th className="px-4 py-2 font-semibold text-center">Clicks</th>
                  <th className="px-4 py-2 font-semibold">Activity</th>
                </tr>
              )}
            </thead>
            <tbody>
              {!shownRecipients.length ? (
                <tr>
                  <td colSpan={isWhatsApp ? 5 : 7} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No recipients match.
                  </td>
                </tr>
              ) : isWhatsApp ? (
                shownRecipients.map((row) => (
                  <WhatsAppRecipientRow
                    key={row.enrollmentId}
                    row={row}
                    busy={waBusy}
                    autoSend={Boolean(user?.whatsappAutoSendReady)}
                    onOpenLead={goToLead}
                    onSent={markWhatsAppSent}
                  />
                ))
              ) : (
                shownRecipients.map((row) => (
                  <RecipientRow
                    key={row.enrollmentId}
                    row={row}
                    expanded={expandedId === row.enrollmentId}
                    onToggle={() =>
                      setExpandedId((id) => (id === row.enrollmentId ? null : row.enrollmentId))
                    }
                    onOpenLead={goToLead}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        {hasMoreRecipients && (
          <div className="px-4 py-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setListVisible((n) => n + PAGE_SIZE)}
              className="w-full text-xs font-semibold py-2 text-[#FF773D] hover:underline"
            >
              Load more ({recipients.length - listVisible} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CampaignReportsView({
  campaigns,
  onNavigate,
  onDuplicate,
  onReload,
  busy,
  initialCampaignId,
  showCreator = false,
}) {
  const [reportCampaignId, setReportCampaignId] = useState(initialCampaignId || null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [listVisible, setListVisible] = useState(PAGE_SIZE)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    if (initialCampaignId) setReportCampaignId(initialCampaignId)
  }, [initialCampaignId])

  const rows = useMemo(
    () =>
      [...(campaigns || [])].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
      ),
    [campaigns]
  )

  const visibleRows = rows.slice(0, listVisible)
  const hasMoreList = listVisible < rows.length
  const reportCampaign = rows.find((c) => c.id === reportCampaignId)

  const allSelected = visibleRows.length > 0 && visibleRows.every((c) => selectedIds.has(c.id))
  const someSelected = selectedIds.size > 0

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        visibleRows.forEach((c) => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        visibleRows.forEach((c) => next.add(c.id))
        return next
      })
    }
  }

  const deleteSelected = async () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const names = ids
      .map((id) => rows.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .slice(0, 5)
    const label =
      ids.length === 1
        ? `Delete campaign “${names[0] || 'this campaign'}”?`
        : `Delete ${ids.length} campaigns? This cannot be undone.`
    if (!window.confirm(label)) return

    setDeleteBusy(true)
    setDeleteError(null)
    const failed = []
    for (const id of ids) {
      try {
        await api.deleteMarketingCampaign(id)
      } catch (e) {
        failed.push({ id, message: e.message })
      }
    }
    setDeleteBusy(false)
    if (failed.length) {
      setDeleteError(
        failed.length === ids.length
          ? failed[0].message
          : `${failed.length} could not be deleted (pause active campaigns first).`
      )
    } else {
      setSelectedIds(new Set())
      if (ids.includes(reportCampaignId)) setReportCampaignId(null)
    }
    await onReload?.()
  }

  const openReport = (id, e) => {
    e?.stopPropagation?.()
    setReportCampaignId(id)
  }

  return (
    <div className="space-y-4 max-w-6xl p-1">
      {reportCampaignId && reportCampaign && (
        <ReportOverlay
          wide
          title={reportCampaign.name}
          onClose={() => setReportCampaignId(null)}
        >
          <CampaignDetailReport
            campaignId={reportCampaignId}
            campaignName={reportCampaign.name}
            onClose={() => setReportCampaignId(null)}
            onNavigate={onNavigate}
            onDuplicate={onDuplicate}
            busy={busy}
          />
        </ReportOverlay>
      )}

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Campaign reports</h2>
          <div className="flex flex-wrap items-center gap-2">
            {someSelected && (
              <button
                type="button"
                disabled={deleteBusy || busy}
                onClick={deleteSelected}
                className="text-xs font-semibold px-3 py-1.5 text-red-800 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {deleteBusy ? 'Deleting…' : `Delete (${selectedIds.size})`}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate?.('marketing', { tab: 'campaigns' })}
              className="text-xs font-semibold text-[#FF773D] hover:underline shrink-0"
            >
              Manage campaigns
            </button>
          </div>
        </div>

        {deleteError && (
          <p className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">{deleteError}</p>
        )}

        {!rows.length ? (
          <p className="text-sm text-gray-500 p-6">No campaigns yet — create one under Campaigns.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100 bg-gray-50/80">
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all visible campaigns"
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-2 font-semibold">Campaign</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 font-semibold">Sent</th>
                    <th className="px-4 py-2 font-semibold">Bounced</th>
                    <th className="px-4 py-2 font-semibold">Opens</th>
                    <th className="px-4 py-2 font-semibold">Clicks</th>
                    <th className="px-4 py-2 font-semibold w-28" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((c) => {
                    const stats = c.stats || c.analytics || {}
                    const sentCount = stats.recipientsSent ?? stats.sent ?? 0
                    const checked = selectedIds.has(c.id)
                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-gray-50 hover:bg-gray-50/80 ${checked ? 'bg-[#fff4ee]/30' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(c.id)}
                            aria-label={`Select ${c.name}`}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{c.name}</span>
                            {showCreator && (
                              <MarketingCreatorBadge name={c.createdByName} isOwn={c.isOwn} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-600">{c.status}</td>
                        <td className="px-4 py-3 tabular-nums">{sentCount}</td>
                        <td className="px-4 py-3 tabular-nums text-red-700">{stats.bounced || 0}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {stats.uniqueOpens ?? stats.opens ?? 0}
                          {sentCount > 0 ? (
                            <span className="text-gray-400 text-xs"> ({stats.openRate || 0}%)</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {stats.uniqueClicks ?? stats.clicks ?? 0}
                          {sentCount > 0 ? (
                            <span className="text-gray-400 text-xs"> ({stats.clickRate || 0}%)</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => openReport(c.id, e)}
                            className="text-xs font-semibold text-[#FF773D] hover:underline"
                          >
                            View report
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {hasMoreList && (
              <div className="px-4 py-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setListVisible((n) => n + PAGE_SIZE)}
                  className="w-full text-xs font-semibold py-2 text-[#FF773D] hover:underline"
                >
                  Load more ({rows.length - listVisible} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
