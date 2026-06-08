import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import PlatformSupportTickets from './PlatformSupportTickets'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'tickets', label: 'Support tickets' },
  { id: 'users', label: 'Customers' },
  { id: 'organizations', label: 'Organizations' },
]

export default function PlatformCustomersPanel({ onNavigate, panelOptions = {} }) {
  const { user } = useApp()
  const [tab, setTab] = useState(panelOptions?.tab || 'overview')
  const [query, setQuery] = useState('')
  const [overview, setOverview] = useState(null)
  const [rows, setRows] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedOrgId, setSelectedOrgId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const loadOverview = useCallback(async () => {
    try {
      const data = await api.getAdminSupportOverview()
      setOverview(data)
    } catch {
      // non-blocking
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'organizations') {
        const data = await api.listAdminOrganizations(query)
        setRows(data.organizations || [])
      } else {
        const data = await api.listAdminCustomers(query)
        setRows(data.customers || [])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tab, query])

  const loadDetail = useCallback(async () => {
    if (tab === 'users' && selectedUserId) {
      setDetailLoading(true)
      try {
        const data = await api.getAdminCustomer(selectedUserId)
        setDetail(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setDetailLoading(false)
      }
    } else if (tab === 'organizations' && selectedOrgId) {
      setDetailLoading(true)
      try {
        const data = await api.getAdminOrganization(selectedOrgId)
        setDetail(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setDetailLoading(false)
      }
    } else {
      setDetail(null)
    }
  }, [tab, selectedUserId, selectedOrgId])

  useEffect(() => {
    if (panelOptions?.tab && TABS.some((t) => t.id === panelOptions.tab)) {
      setTab(panelOptions.tab)
    }
  }, [panelOptions?.tab])

  useEffect(() => {
    if (user?.isPlatformAdmin) loadOverview()
  }, [user, loadOverview])

  useEffect(() => {
    if (!user?.isPlatformAdmin) return
    const t = setTimeout(loadList, 200)
    return () => clearTimeout(t)
  }, [user, loadList])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  useEffect(() => {
    setSelectedUserId(null)
    setSelectedOrgId(null)
    setDetail(null)
  }, [tab])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const runAction = async (payload) => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.adminCustomerAction(payload)
      setDetail(data.detail)
      setNotice('Saved')
      await loadList()
      await loadOverview()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!user?.isPlatformAdmin) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Platform operator access required</h2>
          <p className="mt-2 text-sm text-gray-500">Sign in with an email listed in ADMIN_EMAILS on Vercel.</p>
        </div>
      </div>
    )
  }

  const metrics = overview?.metrics || {}

  return (
    <div className="h-full flex flex-col bg-[#f0f1f4] overflow-hidden">
      <header className="shrink-0 bg-gray-900 text-white px-5 py-4 border-b border-gray-800">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF773D]">Connect Intel · Platform backend</p>
        <h1 className="text-xl font-semibold mt-0.5">Customer operations</h1>
        <p className="text-sm text-gray-400 mt-1 max-w-2xl">
          View customer accounts, triage escalations and tickets, adjust credits and CRM access, and help teams get
          unblocked.
        </p>
      </header>

      <div className="shrink-0 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 border-b border-gray-200 bg-white">
        <Metric
          label="Open tickets"
          value={metrics.supportTicketsActive}
          warn={metrics.supportTicketsActive > 0}
        />
        <Metric
          label="Over SLA"
          value={metrics.supportTicketsOverdue}
          warn={metrics.supportTicketsOverdue > 0}
        />
        <Metric label="Customers" value={metrics.totalUsers} />
        <Metric label="Companies" value={metrics.totalOrganizations} />
        <Metric label="Active 7d" value={metrics.activeUsers7d} />
        <Metric label="Low credits" value={metrics.lowCreditUsers} warn={metrics.lowCreditUsers > 0} />
        <Metric label="Onboarding stuck" value={metrics.pendingOnboarding} warn={metrics.pendingOnboarding > 0} />
        <Metric label="New tickets 24h" value={metrics.supportTicketsOpen24h} />
      </div>

      <div className="shrink-0 px-5 py-2 flex flex-wrap items-center gap-2 bg-white border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              tab === t.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search email, name, company…"
          className="ml-auto text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-full sm:w-64"
        />
      </div>

      {(error || notice) && (
        <div className="shrink-0 px-5 pt-2">
          {error && <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {notice && <p className="text-xs text-green-900 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mt-1">{notice}</p>}
        </div>
      )}

      {tab === 'overview' ? (
        <main className="flex-1 overflow-y-auto p-5">
          <div className="max-w-4xl grid sm:grid-cols-2 gap-3">
            <OverviewCard
              title="Escalations"
              description={`${metrics.supportTicketsOverdue || 0} overdue · assistant and high-priority queue`}
              onClick={() => setTab('escalations')}
              warn={metrics.supportTicketsOverdue > 0}
            />
            <OverviewCard
              title="Active tickets"
              description={`${metrics.supportTicketsActive || 0} open · reply within 24–48h SLA`}
              onClick={() => setTab('tickets')}
            />
            <OverviewCard
              title="Customers"
              description={`${metrics.totalUsers || 0} accounts · credits, onboarding, CRM fixes`}
              onClick={() => setTab('users')}
            />
            <OverviewCard
              title="Organizations"
              description={`${metrics.totalOrganizations || 0} companies · team recharge and billing`}
              onClick={() => setTab('organizations')}
            />
            <OverviewCard
              title="Import master data"
              description="Upload exporter and contact sheets for shared search"
              onClick={() => onNavigate?.('admin')}
            />
            <OverviewCard
              title="System status"
              description="Integrations, API health, and environment checks"
              onClick={() => onNavigate?.('integrations')}
            />
          </div>
          {overview?.recentAudit?.length > 0 && (
            <section className="mt-6 max-w-4xl rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Recent operator actions</h3>
              <div className="space-y-1 text-xs text-gray-600">
                {overview.recentAudit.map((a) => (
                  <p key={a.id}>
                    {a.action} · {a.targetType} · {formatDateTime(a.createdAt)}
                  </p>
                ))}
              </div>
            </section>
          )}
        </main>
      ) : tab === 'tickets' || tab === 'escalations' ? (
        <PlatformSupportTickets
          initialStatusFilter={tab === 'escalations' ? 'escalations' : 'active'}
          onSelectCustomer={(userId) => {
            setTab('users')
            setSelectedUserId(userId)
          }}
        />
      ) : (
      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(280px,360px)_1fr]">
        <aside className="border-r border-gray-200 bg-white overflow-y-auto">
          {loading ? (
            <LoadingExperience message={LOADING_MESSAGES.customers} compact fill={false} className="m-2 rounded-lg border border-gray-200" />
          ) : !rows.length ? (
            <p className="p-4 text-sm text-gray-500">No results.</p>
          ) : tab === 'users' ? (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedUserId(row.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                  selectedUserId === row.id ? 'bg-[#fff4ee] border-l-2 border-l-[#FF773D]' : ''
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{row.name}</p>
                <p className="text-xs text-gray-500 truncate">{row.email}</p>
                <p className="text-xs text-gray-400 mt-1 truncate">
                  {row.organizationName || row.accountType} · ₹{row.creditBalanceRupees} ·{' '}
                  {row.onboardingComplete ? 'Active' : 'Onboarding'}
                </p>
              </button>
            ))
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedOrgId(row.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                  selectedOrgId === row.id ? 'bg-[#fff4ee] border-l-2 border-l-[#FF773D]' : ''
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{row.name}</p>
                <p className="text-xs text-gray-500 truncate">{row.ownerEmail || row.domain}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {row.memberCount} members · {row.pipelineLeads} leads
                </p>
              </button>
            ))
          )}
        </aside>

        <main className="overflow-y-auto p-4 sm:p-5">
          {detailLoading ? (
            <LoadingExperience message="Loading customer details…" compact fill={false} className="rounded-xl border border-gray-200" />
          ) : tab === 'users' && detail?.user ? (
            <CustomerDetail detail={detail} busy={busy} onAction={runAction} />
          ) : tab === 'organizations' && detail?.organization ? (
            <OrganizationDetail detail={detail} busy={busy} onAction={runAction} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Select a {tab === 'users' ? 'customer' : 'organization'} to manage access and credits.
            </div>
          )}
        </main>
      </div>
      )}

      {overview?.recentAudit?.length > 0 && !['tickets', 'escalations', 'overview'].includes(tab) && (
        <footer className="shrink-0 border-t border-gray-200 bg-white px-5 py-2 max-h-24 overflow-y-auto">
          <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Recent support actions</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            {overview.recentAudit.map((a) => (
              <span key={a.id}>
                {a.action} · {a.targetType} {a.targetId?.slice(0, 8)}… · {formatDateTime(a.createdAt)}
              </span>
            ))}
          </div>
        </footer>
      )}
    </div>
  )
}

function OverviewCard({ title, description, onClick, warn = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 hover:shadow-sm transition-shadow ${
        warn ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-xs text-gray-600 mt-1">{description}</p>
    </button>
  )
}

function Metric({ label, value, warn = false }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${warn ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
      <p className="text-xs text-gray-500 uppercase font-semibold">{label}</p>
      <p className={`text-lg font-bold ${warn ? 'text-amber-900' : 'text-gray-900'}`}>{value ?? '—'}</p>
    </div>
  )
}

function CustomerDetail({ detail, busy, onAction }) {
  const u = detail.user
  const [creditRupees, setCreditRupees] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [billingNote, setBillingNote] = useState(u.billingNote || '')
  const invoiceRows = buildInvoicesFromLedger(detail.creditLedger || [], detail.payment)

  return (
    <div className="max-w-3xl space-y-4">
      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{u.name}</h2>
            <p className="text-sm text-gray-600">{u.email}</p>
            <p className="text-xs text-gray-500 mt-1">
              {u.organizationName || 'Individual'} · {u.accountType} · Last login{' '}
              {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge ok={u.onboardingComplete} label={u.onboardingComplete ? 'Onboarded' : 'Onboarding pending'} />
            <Badge ok={u.canSearch} label={u.canSearch ? 'Search on' : 'Search off'} />
            <Badge ok={u.subscriptionActive} label={u.subscriptionActive ? 'Sub active' : 'No sub flag'} />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Company details</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-700">
          <Field label="Company" value={u.organizationName || u.company || '—'} />
          <Field label="Account type" value={u.accountType} />
          <Field label="Organization role" value={u.orgRole || 'individual'} />
          <Field label="Pipeline role" value={u.pipelineRole || '—'} />
          <Field label="Mobile" value={u.mobile || '—'} />
          <Field label="Created" value={u.createdAt ? formatDateTime(u.createdAt) : '—'} />
        </div>
      </section>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Wallet" value={`₹${u.creditBalanceRupees}`} />
        <Stat label="Pipeline leads" value={detail.usage?.pipelineLeads ?? 0} />
        <Stat label="Email unlocks" value={detail.usage?.unlocks ?? 0} />
        <Stat label="AI searches left" value={u.aiDiscoverySearchesLeft ?? '—'} />
        <Stat label="DB searches left" value={u.searchesLeft ?? '—'} />
        <Stat label="Gmail CRM" value={u.crmGmailConnected ? 'Connected' : 'Not connected'} />
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Billing</h3>
        <p className="text-xs text-gray-500">
          {detail.payment?.paymentGateway} · Plan: {u.plan || 'free'} · Subscription:{' '}
          {u.subscriptionActive ? 'Active' : 'Inactive'}
        </p>
        {detail.payment?.lastCreditGrant && (
          <p className="text-xs text-gray-600">
            Last grant: ₹{(detail.payment.lastCreditGrant.amountPaise / 100).toFixed(0)} —{' '}
            {detail.payment.lastCreditGrant.description} ({formatDateTime(detail.payment.lastCreditGrant.createdAt)})
          </p>
        )}
        <div className="pt-2 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-800 mb-2">Recharge wallet</h4>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs">
              <span className="block text-gray-500 mb-1">Add credits (₹)</span>
              <input
                type="number"
                min={1}
                value={creditRupees}
                onChange={(e) => setCreditRupees(e.target.value)}
                className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                placeholder="500"
              />
            </label>
            <ActionBtn
              disabled={busy || !creditRupees}
              onClick={() =>
                onAction({
                  userId: u.id,
                  action: 'grant_credits',
                  amountPaise: Math.round(Number(creditRupees) * 100),
                  reason: 'Platform support credit grant',
                })
              }
            >
              Grant credits
            </ActionBtn>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-gray-100">
          <label className="text-xs">
            <span className="block text-gray-500 mb-1">Payment amount (₹)</span>
            <input
              type="number"
              min={1}
              value={creditRupees}
              onChange={(e) => setCreditRupees(e.target.value)}
              className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              placeholder="500"
            />
          </label>
          <label className="text-xs flex-1 min-w-[150px]">
            <span className="block text-gray-500 mb-1">Payment reference</span>
            <input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              placeholder="UPI / invoice #"
            />
          </label>
          <ActionBtn
            disabled={busy}
            onClick={() =>
              onAction({
                userId: u.id,
                action: 'record_payment',
                amountPaise: creditRupees ? Math.round(Number(creditRupees) * 100) : 0,
                reference: paymentRef,
                plan: 'paid',
                note: billingNote,
              })
            }
          >
            Record payment + recharge
          </ActionBtn>
        </div>
        <label className="block text-xs">
          <span className="text-gray-500">Internal billing note</span>
          <textarea
            value={billingNote}
            onChange={(e) => setBillingNote(e.target.value)}
            rows={2}
            className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
          />
          <ActionBtn
            className="mt-2"
            disabled={busy}
            onClick={() =>
              onAction({
                userId: u.id,
                action: 'set_subscription',
                active: u.subscriptionActive,
                billingNote,
              })
            }
          >
            Save billing note
          </ActionBtn>
        </label>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">CRM access & fixes</h3>
        <div className="flex flex-wrap gap-2">
          {!u.onboardingComplete && (
            <ActionBtn disabled={busy} onClick={() => onAction({ userId: u.id, action: 'force_onboarding' })}>
              Complete onboarding
            </ActionBtn>
          )}
          <ActionBtn disabled={busy} onClick={() => onAction({ userId: u.id, action: 'reset_ai_quota' })}>
            Reset AI search quota
          </ActionBtn>
          <ActionBtn
            disabled={busy}
            onClick={() => onAction({ userId: u.id, action: 'set_searches_left', searchesLeft: 100 })}
          >
            Set 100 DB searches
          </ActionBtn>
          {u.organizationId && (
            <>
              <ActionBtn
                disabled={busy}
                onClick={() => onAction({ userId: u.id, action: 'set_membership_can_search', canSearch: true })}
              >
                Enable search (member)
              </ActionBtn>
              <ActionBtn
                disabled={busy}
                onClick={() =>
                  onAction({ userId: u.id, action: 'set_subscription', active: true, plan: 'crm_full' })
                }
              >
                Enable full CRM flag
              </ActionBtn>
            </>
          )}
          {!u.organizationId && (
            <ActionBtn
              disabled={busy}
              onClick={() => onAction({ userId: u.id, action: 'set_subscription', active: true, plan: 'crm_full' })}
            >
              Enable full CRM flag
            </ActionBtn>
          )}
        </div>
      </section>

      {detail.creditLedger?.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Credit ledger</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {detail.creditLedger.map((row) => (
              <p key={row.id} className="text-xs text-gray-600">
                {formatDateTime(row.createdAt)} · {row.kind} · ₹{(row.amountPaise / 100).toFixed(2)} · {row.description}
              </p>
            ))}
          </div>
        </section>
      )}

      {detail.supportTickets?.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Support tickets</h3>
          <ul className="space-y-2">
            {detail.supportTickets.map((ticket) => (
              <li key={ticket.id} className="text-xs text-gray-700 rounded-lg border border-gray-100 px-3 py-2">
                <span className="font-semibold text-gray-900">{ticket.ticketNumber}</span> · {ticket.subject} ·{' '}
                <span className="capitalize">{ticket.status.replace(/_/g, ' ')}</span> ·{' '}
                {formatDateTime(ticket.createdAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Invoices</h3>
        <p className="text-xs text-gray-500 mb-2">
          Manual invoice timeline derived from payment records. Use payment reference while recording payment.
        </p>
        <InvoiceTable rows={invoiceRows} />
      </section>
    </div>
  )
}

function OrganizationDetail({ detail, busy, onAction }) {
  const org = detail.organization
  const [billingNote, setBillingNote] = useState(org.billingNote || '')
  return (
    <div className="max-w-3xl space-y-4">
      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">{org.name}</h2>
        <p className="text-sm text-gray-600">{org.domain}</p>
        <p className="text-xs text-gray-500 mt-2">
          {detail.members?.length ?? 0} members · {org.pipelineLeads} pipeline leads · Email domain:{' '}
          {org.emailDomainStatus || 'none'}
        </p>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Company details</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-700">
          <Field label="Domain" value={org.domain || '—'} />
          <Field label="Created" value={org.createdAt ? formatDateTime(org.createdAt) : '—'} />
          <Field label="Email domain" value={org.emailDomainName || 'Not configured'} />
          <Field label="Email status" value={org.emailDomainStatus || '—'} />
          <Field label="Subscription" value={org.subscriptionActive ? 'Active' : 'Inactive'} />
          <Field label="Onboarding" value={org.onboardingComplete ? 'Complete' : 'Pending'} />
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Billing & recharge</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Stat label="Team searches left" value={org.searchesLeft ?? 0} />
          <Stat label="Org wallet (₹)" value={Number(((org.creditsPaise || 0) / 100).toFixed(2))} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionBtn
            disabled={busy}
            onClick={() => onAction({ organizationId: org.id, action: 'set_searches_left', searchesLeft: 500 })}
          >
            Recharge: set 500 searches
          </ActionBtn>
          <ActionBtn
            disabled={busy}
            onClick={() => onAction({ organizationId: org.id, action: 'set_searches_left', searchesLeft: 1000 })}
          >
            Recharge: set 1000 searches
          </ActionBtn>
          <ActionBtn
            disabled={busy}
            onClick={() => onAction({ organizationId: org.id, action: 'set_subscription', active: true })}
          >
            Activate subscription
          </ActionBtn>
        </div>
        <label className="block text-xs">
          <span className="text-gray-500">Billing note (company-level)</span>
          <textarea
            value={billingNote}
            onChange={(e) => setBillingNote(e.target.value)}
            rows={2}
            className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
          />
          <ActionBtn
            className="mt-2"
            disabled={busy}
            onClick={() =>
              onAction({
                organizationId: org.id,
                action: 'set_subscription',
                active: org.subscriptionActive,
                billingNote,
              })
            }
          >
            Save billing note
          </ActionBtn>
        </label>
      </section>

      <div className="flex flex-wrap gap-2">
        <ActionBtn disabled={busy} onClick={() => onAction({ organizationId: org.id, action: 'force_onboarding' })}>
          Complete org onboarding
        </ActionBtn>
      </div>

      {detail.members?.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Team members</h3>
          <div className="divide-y divide-gray-100">
            {detail.members.map((m) => (
              <div key={m.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.email}</p>
                </div>
                <div className="flex gap-1">
                  <ActionBtn
                    disabled={busy}
                    onClick={() =>
                      onAction({
                        organizationId: org.id,
                        action: 'update_member',
                        userId: m.id,
                        canSearch: true,
                      })
                    }
                  >
                    Enable search
                  </ActionBtn>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {detail.pendingInvites?.length > 0 && (
        <section className="bg-white rounded-xl border border-amber-200 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Pending invites</h3>
          {detail.pendingInvites.map((i) => (
            <p key={i.id} className="text-xs text-gray-600 mt-1">
              {i.email} · expires {formatDateTime(i.expiresAt)}
            </p>
          ))}
        </section>
      )}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
      <p className="text-xs uppercase font-semibold text-gray-400">{label}</p>
      <p className="text-xs text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}

function buildInvoicesFromLedger(ledger, payment) {
  const rows = (ledger || [])
    .filter((row) => row.kind === 'grant' || row.kind === 'adjustment')
    .filter((row) => /payment|invoice|upi|bank|txn|ref/i.test(String(row.description || '')))
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      amountPaise: row.amountPaise || 0,
      reference: row.description || 'Manual payment',
      status: 'paid',
    }))
  if (!rows.length && payment?.lastCreditGrant) {
    rows.push({
      id: 'fallback-last-payment',
      createdAt: payment.lastCreditGrant.createdAt,
      amountPaise: payment.lastCreditGrant.amountPaise || 0,
      reference: payment.lastCreditGrant.description || 'Credit grant',
      status: 'paid',
    })
  }
  return rows
}

function InvoiceTable({ rows }) {
  if (!rows?.length) {
    return <p className="text-xs text-gray-500">No invoices recorded yet. Record a payment reference to create one.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="py-1 pr-3">Date</th>
            <th className="py-1 pr-3">Reference</th>
            <th className="py-1 pr-3">Amount</th>
            <th className="py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-50 text-gray-700">
              <td className="py-1.5 pr-3">{formatDateTime(row.createdAt)}</td>
              <td className="py-1.5 pr-3">{row.reference}</td>
              <td className="py-1.5 pr-3">₹{(Number(row.amountPaise || 0) / 100).toFixed(2)}</td>
              <td className="py-1.5">
                <span className="inline-flex rounded-full bg-green-100 text-green-800 px-2 py-0.5 font-semibold">
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
      <p className="text-xs uppercase font-semibold text-gray-400">{label}</p>
      <p className="text-base font-bold text-gray-900">{value}</p>
    </div>
  )
}

function Badge({ ok, label }) {
  return (
    <span
      className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
        ok ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {label}
    </span>
  )
}

function ActionBtn({ children, disabled, onClick, className = '' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}
