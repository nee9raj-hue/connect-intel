import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { DEFAULT_THEME } from '../../lib/marketingEmailDesign'
import { formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import MarketingCreatorBadge from './MarketingCreatorBadge'

const FILTERS = [
  { id: 'all', label: 'All recipients' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'opened', label: 'Opened' },
  { id: 'clicked', label: 'Clicked' },
  { id: 'bounced', label: 'Bounced' },
  { id: 'failed', label: 'Failed' },
  { id: 'unsubscribed', label: 'Unsubscribed' },
]

const STATUS_STYLES = {
  delivered: 'bg-emerald-50 text-emerald-800 border-emerald-100',
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

function KpiCard({ label, value, sub, active, onClick, accent }) {
  const base =
    'text-left rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md ' +
    (active ? 'ring-2 ring-gray-900 border-gray-300 bg-white shadow-sm' : 'border-gray-200 bg-white')
  return (
    <button type="button" onClick={onClick} className={base}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${accent || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
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
          className="font-medium text-gray-900 hover:text-[#5b4a00] hover:underline text-left"
        >
          {row.name || '—'}
        </button>
        {row.company && <p className="text-[11px] text-gray-500">{row.company}</p>}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600">{row.phone || '—'}</td>
      <td className="px-4 py-3">
        <p className="text-xs text-gray-700 line-clamp-3 max-w-md whitespace-pre-wrap">
          {row.whatsappMessage || '—'}
        </p>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${statusClass}`}>
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
            <span className="text-[10px] text-red-700 line-clamp-2">{row.lastError}</span>
          )}
          {autoSend && row.lastSentAt && (
            <span className="text-[10px] text-gray-500">Sent {formatDateTime(row.lastSentAt)}</span>
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
            className="font-medium text-gray-900 hover:text-[#5b4a00] hover:underline text-left"
          >
            {row.name || '—'}
          </button>
          {row.title && <p className="text-[11px] text-gray-500">{row.title}</p>}
        </td>
        <td className="px-4 py-3 text-gray-600">{row.company || '—'}</td>
        <td className="px-4 py-3 text-gray-600 text-xs">{row.email}</td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${statusClass}`}>
            {row.deliveryStatus}
          </span>
        </td>
        <td className="px-4 py-3 tabular-nums text-center">
          {row.opens > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              className="font-semibold text-emerald-700 hover:underline"
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

function CampaignDetailReport({ campaignId, campaignName, onBack, onNavigate, onDuplicate, busy }) {
  const { openPipelineLead, user } = useApp()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [search, setSearch] = useState('')
  const [waBusy, setWaBusy] = useState(false)
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

  const goToLead = (leadId) => {
    if (!leadId) return
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
  const recipients = useMemo(() => {
    let rows = report?.recipients || []
    if (filter === 'delivered') rows = rows.filter((r) => r.deliveryStatus === 'delivered')
    else if (filter === 'opened') rows = rows.filter((r) => r.opens > 0)
    else if (filter === 'clicked') rows = rows.filter((r) => r.clicks > 0)
    else if (filter === 'bounced') rows = rows.filter((r) => r.deliveryStatus === 'bounced')
    else if (filter === 'failed') rows = rows.filter((r) => r.deliveryStatus === 'failed')
    else if (filter === 'unsubscribed') rows = rows.filter((r) => r.deliveryStatus === 'unsubscribed')
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
  }, [report?.recipients, filter, search])

  if (loading) {
    return <LoadingExperience message="Loading campaign report…" fill={false} className="py-16" />
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-700">{error}</p>
        <button type="button" onClick={onBack} className="mt-3 text-xs font-semibold underline">
          Back to all campaigns
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="text-xs text-gray-500 hover:text-gray-800 underline mb-1">
            ← All campaigns
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{campaignName || report?.campaign?.name}</h2>
            {report?.campaign?.createdByName && (
              <MarketingCreatorBadge
                name={report.campaign.createdByName}
                isOwn={report.campaign.createdByUserId === user?.id}
              />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">
            {report?.campaign?.status} ·{' '}
            {isWhatsApp ? 'WhatsApp' : 'Email'} ·{' '}
            {report?.campaign?.type === 'sequence' ? 'Sequence' : 'One-shot'}
            {report?.campaign?.startedAt && ` · Started ${formatDateTime(report.campaign.startedAt)}`}
          </p>
          {isWhatsApp && !user?.whatsappAutoSendReady && (
            <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2 max-w-xl">
              Open WhatsApp for each contact (message is pre-filled). Tap Mark sent after you send — activity is
              logged on the lead. Connect WhatsApp Business API under Team for automatic delivery.
            </p>
          )}
          {isWhatsApp && user?.whatsappAutoSendReady && (
            <p className="text-[11px] text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 mt-2 max-w-xl">
              Messages are sent automatically via your WhatsApp Business number. Failed rows show the API error.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDuplicate?.(campaignId)}
            className="text-xs font-semibold px-3 py-2 bg-[#ffcb2b] text-[#242424] rounded-lg disabled:opacity-50"
          >
            Duplicate & resend
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

      <div className={`grid gap-3 ${isWhatsApp ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
        <KpiCard
          label="Enrolled"
          value={stats.enrolled ?? 0}
          sub={isWhatsApp ? 'With phone' : `${stats.sent ?? 0} sent`}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <KpiCard
          label="Sent"
          value={stats.sent ?? 0}
          sub={isWhatsApp ? (user?.whatsappAutoSendReady ? 'Via API' : 'Marked sent') : `${stats.enrolled ?? 0} enrolled`}
          active={filter === 'delivered'}
          onClick={() => setFilter('delivered')}
          accent="text-emerald-700"
        />
        {!isWhatsApp && (
          <>
            <KpiCard
              label="Bounced"
              value={stats.bounced ?? 0}
              sub={stats.sent ? `${stats.bounceRate ?? 0}% bounce` : ''}
              active={filter === 'bounced'}
              onClick={() => setFilter('bounced')}
              accent="text-red-700"
            />
            <KpiCard
              label="Opened"
              value={stats.uniqueOpens ?? 0}
              sub={`${stats.openRate ?? 0}% unique`}
              active={filter === 'opened'}
              onClick={() => setFilter('opened')}
              accent="text-emerald-700"
            />
            <KpiCard
              label="Clicked"
              value={stats.uniqueClicks ?? 0}
              sub={`${stats.clickRate ?? 0}% unique`}
              active={filter === 'clicked'}
              onClick={() => setFilter('clicked')}
              accent="text-blue-700"
            />
            <KpiCard
              label="Failed"
              value={(stats.failed ?? 0) + (stats.unsubscribed ?? 0)}
              sub={`${stats.unsubscribed ?? 0} unsubscribed`}
              active={filter === 'failed'}
              onClick={() => setFilter('failed')}
              accent="text-orange-700"
            />
          </>
        )}
        {isWhatsApp && (
          <>
            <KpiCard
              label="Pending"
              value={stats.pending ?? 0}
              sub="Not sent yet"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <KpiCard
              label="Failed"
              value={stats.failed ?? 0}
              sub="Missing phone / error"
              active={filter === 'failed'}
              onClick={() => setFilter('failed')}
              accent="text-orange-700"
            />
          </>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          {!isWhatsApp && (
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                    filter === f.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isWhatsApp ? 'Search name, phone, company…' : 'Search name, email, company…'}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-48 sm:w-56"
          />
        </div>

        <p className="px-4 py-2 text-[11px] text-gray-500 border-b border-gray-50">
          {isWhatsApp ? (
            <>
              Each row uses your <strong>saved template</strong> merged with lead fields. Open WhatsApp on your
              phone, then Mark sent.
            </>
          ) : (
            <>
              Click a <strong>name</strong> to open that lead in Pipeline. Click open/click counts for link
              details.
            </>
          )}
        </p>

        <div className="overflow-x-auto max-h-[min(520px,60vh)] overflow-y-auto">
          <table className={`w-full text-sm ${isWhatsApp ? 'min-w-[640px]' : 'min-w-[720px]'}`}>
            <thead className="sticky top-0 bg-gray-50 z-10">
              {isWhatsApp ? (
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-2 font-semibold">Contact</th>
                  <th className="px-4 py-2 font-semibold">Phone</th>
                  <th className="px-4 py-2 font-semibold">Message preview</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Actions</th>
                </tr>
              ) : (
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-2 font-semibold">Contact</th>
                  <th className="px-4 py-2 font-semibold">Company</th>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Delivery</th>
                  <th className="px-4 py-2 font-semibold text-center">Opens</th>
                  <th className="px-4 py-2 font-semibold text-center">Clicks</th>
                  <th className="px-4 py-2 font-semibold">Activity</th>
                </tr>
              )}
            </thead>
            <tbody>
              {!recipients.length ? (
                <tr>
                  <td colSpan={isWhatsApp ? 5 : 7} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No recipients match this filter.
                  </td>
                </tr>
              ) : isWhatsApp ? (
                recipients.map((row) => (
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
                recipients.map((row) => (
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
      </div>
    </div>
  )
}

export default function CampaignReportsView({
  campaigns,
  summary,
  onNavigate,
  onDuplicate,
  busy,
  initialCampaignId,
  showCreator = false,
}) {
  const [selectedId, setSelectedId] = useState(initialCampaignId || null)

  useEffect(() => {
    if (initialCampaignId) setSelectedId(initialCampaignId)
  }, [initialCampaignId])
  const rows = [...(campaigns || [])].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  )

  const selected = rows.find((c) => c.id === selectedId)

  if (selectedId && selected) {
    return (
      <CampaignDetailReport
        campaignId={selectedId}
        campaignName={selected.name}
        onBack={() => setSelectedId(null)}
        onNavigate={onNavigate}
        onDuplicate={onDuplicate}
        busy={busy}
      />
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Campaigns', value: summary?.campaigns ?? rows.length },
          { label: 'Emails sent', value: summary?.sent ?? 0 },
          { label: 'Unique opens', value: summary?.opens ?? 0 },
          { label: 'Unique clicks', value: summary?.clicks ?? 0 },
          { label: 'Enrolled', value: summary?.enrolled ?? 0 },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Campaign reports</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Select a campaign for delivery, bounces, opens, clicks, and per-contact activity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('marketing', { tab: 'campaigns' })}
            className="text-xs font-semibold text-[#5b4a00] hover:underline shrink-0"
          >
            Manage campaigns
          </button>
        </div>
        {!rows.length ? (
          <p className="text-sm text-gray-500 p-6">No campaigns yet — create one under Campaigns.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-100 bg-gray-50/80">
                  <th className="px-4 py-2 font-semibold">Campaign</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Sent</th>
                  <th className="px-4 py-2 font-semibold">Bounced</th>
                  <th className="px-4 py-2 font-semibold">Opens</th>
                  <th className="px-4 py-2 font-semibold">Clicks</th>
                  <th className="px-4 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const stats = c.stats || c.analytics || {}
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-50 hover:bg-[#fffbeb]/40 cursor-pointer"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{c.name}</span>
                          {showCreator && (
                            <MarketingCreatorBadge name={c.createdByName} isOwn={c.isOwn} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600">{c.status}</td>
                      <td className="px-4 py-3 tabular-nums">{stats.sent || 0}</td>
                      <td className="px-4 py-3 tabular-nums text-red-700">{stats.bounced || 0}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {stats.uniqueOpens ?? stats.opens ?? 0}
                        {stats.sent > 0 ? (
                          <span className="text-gray-400 text-xs"> ({stats.openRate || 0}%)</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {stats.uniqueClicks ?? stats.clicks ?? 0}
                        {stats.sent > 0 ? (
                          <span className="text-gray-400 text-xs"> ({stats.clickRate || 0}%)</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-semibold text-[#5b4a00]">View report →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
