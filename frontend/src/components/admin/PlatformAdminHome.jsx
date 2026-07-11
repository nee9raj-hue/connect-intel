import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import PlatformOperatorGate from './PlatformOperatorGate'

const QUICK_LINKS = [
  {
    panel: 'admin-customers',
    tab: 'escalations',
    title: 'Escalations',
    description: 'High priority, overdue SLA, and assistant handoffs',
    accent: 'border-amber-200 bg-amber-50',
  },
  {
    panel: 'admin-customers',
    tab: 'tickets',
    title: 'Support tickets',
    description: 'Reply by email and update ticket status',
    accent: 'border-blue-200 bg-blue-50',
  },
  {
    panel: 'admin-customers',
    tab: 'users',
    title: 'Customers',
    description: 'Credits, onboarding, CRM access, and billing',
    accent: 'border-violet-200 bg-violet-50',
  },
  {
    panel: 'admin-customers',
    tab: 'organizations',
    title: 'Organizations',
    description: 'Team seats, search recharge, and org billing',
    accent: 'border-teal-200 bg-teal-50',
  },
  {
    panel: 'admin',
    title: 'Data & imports',
    description: 'Master exporter database and platform WhatsApp',
    accent: 'border-orange-200 bg-orange-50',
  },
  {
    panel: 'integrations',
    title: 'System status',
    description: 'API health, integrations, and record counts',
    accent: 'border-gray-200 bg-gray-50',
  },
]

export default function PlatformAdminHome({ onNavigate }) {
  const { user } = useApp()
  const [overview, setOverview] = useState(null)
  const [importCounts, setImportCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [support, imports] = await Promise.all([
        api.getAdminSupportOverview(),
        api.getAdminOverview(),
      ])
      setOverview(support)
      setImportCounts(imports?.counts || null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.isPlatformAdmin) load()
  }, [user, load])

  if (!user?.isPlatformAdmin) {
    return <PlatformOperatorGate onNavigate={onNavigate} />
  }

  const metrics = overview?.metrics || {}

  const go = (link) => {
    if (link.tab) {
      onNavigate?.(link.panel, { tab: link.tab })
      return
    }
    onNavigate?.(link.panel)
  }

  return (
    <div className="panel-shell">
      <header className="shrink-0 bg-gray-900 text-white px-5 py-5 border-b border-gray-800">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF773D]">Connect Intel · Platform backend</p>
        <h1 className="text-2xl font-semibold mt-1">Operator console</h1>
        <p className="text-sm text-gray-400 mt-2 max-w-3xl">
          Support customers, manage credits and access, triage escalations, and maintain the shared search database.
        </p>
      </header>

      <div className="panel-body-scroll p-5 md:p-6">
        {loading ? (
          <LoadingExperience message="Loading platform overview…" fill={false} className="rounded-xl border border-gray-200 min-h-[200px]" />
        ) : null}
        {error ? <p className="text-sm text-red-700 mb-4">{error}</p> : null}

        {!loading && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <MetricCard label="Open tickets" value={metrics.supportTicketsActive} warn={metrics.supportTicketsActive > 0} />
              <MetricCard label="Over SLA" value={metrics.supportTicketsOverdue} warn={metrics.supportTicketsOverdue > 0} />
              <MetricCard label="Customers" value={metrics.totalUsers} />
              <MetricCard label="Organizations" value={metrics.totalOrganizations} />
              <MetricCard label="Onboarding stuck" value={metrics.pendingOnboarding} warn={metrics.pendingOnboarding > 0} />
              <MetricCard label="Low credits" value={metrics.lowCreditUsers} warn={metrics.lowCreditUsers > 0} />
            </div>

            {importCounts ? (
              <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Master database</h2>
                <p className="text-xs text-gray-500 mt-1 mb-3">Shared companies and contacts used in customer AI search.</p>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Companies" value={importCounts.companies} compact />
                  <MetricCard label="Contacts" value={importCounts.contacts} compact />
                  <MetricCard label="Import jobs" value={importCounts.imports} compact />
                </div>
              </div>
            ) : null}

            <h2 className="text-sm font-semibold text-gray-900 mb-3">Work areas</h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
              {QUICK_LINKS.map((link) => (
                <button
                  key={`${link.panel}-${link.tab || 'main'}`}
                  type="button"
                  onClick={() => go(link)}
                  className={`text-left rounded-2xl border p-4 hover:shadow-sm transition-shadow ${link.accent}`}
                >
                  <p className="text-sm font-semibold text-gray-900">{link.title}</p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{link.description}</p>
                </button>
              ))}
            </div>

            {overview?.recentAudit?.length > 0 ? (
              <section className="rounded-2xl border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Recent operator actions</h2>
                <ul className="space-y-1 text-xs text-gray-600">
                  {overview.recentAudit.map((row) => (
                    <li key={row.id}>
                      {row.action} · {row.targetType} · {row.actorEmail} · {formatDateTime(row.createdAt)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, warn = false, compact = false }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${warn ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'} ${compact ? '' : 'min-h-[72px]'}`}
    >
      <p className="text-xs text-gray-500 uppercase font-semibold">{label}</p>
      <p className={`font-bold text-gray-900 ${compact ? 'text-lg' : 'text-2xl'} ${warn ? 'text-amber-900' : ''}`}>
        {value ?? '—'}
      </p>
    </div>
  )
}
