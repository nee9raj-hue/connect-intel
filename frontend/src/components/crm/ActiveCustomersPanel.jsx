import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getStatusMeta } from '../../lib/crmConstants'
import { parseUploadFile } from '../../lib/parseUpload'
import {
  downloadActiveTradingTemplateCsv,
  downloadActiveTradingTemplateXlsx,
} from '../../lib/activeTradingImportTemplate'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

function formatIsoDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export default function ActiveCustomersPanel({ onNavigate }) {
  const { user, openPipelineLead, refreshSavedLeads, teamMembers } = useApp()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [customers, setCustomers] = useState([])
  const [stats, setStats] = useState(null)
  const [imports, setImports] = useState([])
  const [search, setSearch] = useState('')
  const [unmatched, setUnmatched] = useState([])
  const [fileName, setFileName] = useState('')

  const isCompany = user?.accountType === 'company'

  const load = useCallback(async () => {
    if (!isCompany) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await api.getActiveTradingOverview()
      setCustomers(data.customers || [])
      setStats(data.customerStats || data.stats || null)
      setImports(data.imports || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [isCompany])

  useEffect(() => {
    load()
  }, [load])

  const assigneeName = useMemo(() => {
    const map = new Map((teamMembers || []).map((m) => [m.userId, m.name]))
    return (id) => map.get(id) || '—'
  }, [teamMembers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    )
  }, [customers, search])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setNotice(null)
    setUnmatched([])
    try {
      const rows = await parseUploadFile(file)
      setFileName(file.name)
      setBusy(true)
      const data = await api.importActiveTrading({ rows, promoteToActive: true })
      setNotice(data.message || 'Import complete')
      setUnmatched(data.unmatched || [])
      await refreshSavedLeads?.()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  if (!isCompany) {
    return (
      <div className="p-8 text-center text-sm text-gray-500 max-w-md mx-auto">
        Active customers dashboard is for company workspaces. Complete onboarding as a company account.
      </div>
    )
  }

  return (
    <div className="panel-shell bg-[#f6f7f9]">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Active customers</h1>
        <p className="text-xs text-gray-500 mt-0.5 max-w-2xl leading-relaxed">
          Companies with trading activity (first shipment and beyond). Upload CSV/Excel matched by{' '}
          <strong>mobile number</strong> — same format as pipeline phones. Matched leads move to{' '}
          <strong>Active trading</strong> in Pipeline.
        </p>
      </header>

      <div className="panel-body-scroll p-5 space-y-5 max-w-6xl">
        {(error || notice) && (
          <div className="space-y-2">
            {error && (
              <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {notice && (
              <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                {notice}
              </p>
            )}
          </div>
        )}

        <section className="bg-white rounded-xl border border-teal-200/60 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Import shipment data</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Use the template. Required: <strong>mobile</strong> (with country code). Optional: first/last shipment
            dates, shipment count, semicolon-separated <strong>shipments</strong> dates, ERP customer code, GSTIN.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadActiveTradingTemplateXlsx}
              className="text-xs font-semibold px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Download Excel template
            </button>
            <button
              type="button"
              onClick={downloadActiveTradingTemplateCsv}
              className="text-xs font-semibold px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Download CSV template
            </button>
            <label className="text-xs font-semibold px-3 py-2 bg-teal-600 text-white rounded-lg cursor-pointer hover:bg-teal-700">
              {busy ? 'Importing…' : 'Upload file'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={busy}
                onChange={handleFile}
              />
            </label>
            {fileName && <span className="text-xs text-gray-500 self-center">{fileName}</span>}
          </div>
          {unmatched.length > 0 && (
            <details className="text-xs border border-amber-100 rounded-lg bg-amber-50/80 p-3">
              <summary className="font-semibold text-amber-950 cursor-pointer">
                {unmatched.length} row(s) not matched — review
              </summary>
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto text-amber-900">
                {unmatched.slice(0, 50).map((u, i) => (
                  <li key={i}>
                    {u.phone || 'no phone'} — {u.company || '—'} — {u.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {imports[0] && (
            <p className="text-[10px] text-gray-400">
              Last import: {formatIsoDate(imports[0].uploadedAt)} · {imports[0].updatedLeads} leads updated ·{' '}
              {imports[0].unmatchedCount} unmatched
            </p>
          )}
        </section>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Active customers" value={stats.total ?? 0} />
            <StatCard label="New this month" value={stats.newThisMonth ?? 0} accent="text-teal-700" />
            <StatCard label="Multiple shipments" value={stats.withMultipleShipments ?? 0} />
            <StatCard label="In Active trading stage" value={stats.pipelineActiveStage ?? 0} />
          </div>
        )}

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3 justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Trading customers</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, phone…"
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-56"
            />
          </div>
          {loading ? (
            <LoadingExperience message="Loading active customers…" className="py-16" />
          ) : !filtered.length ? (
            <p className="text-sm text-gray-500 text-center py-12 px-4">
              No active customers yet. Upload a file with mobile numbers that exist in your pipeline, or move
              leads to <strong>Active trading</strong> manually.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Customer</th>
                    <th className="px-4 py-2 font-semibold">Mobile</th>
                    <th className="px-4 py-2 font-semibold">First shipment</th>
                    <th className="px-4 py-2 font-semibold">Last shipment</th>
                    <th className="px-4 py-2 font-semibold text-center">#</th>
                    <th className="px-4 py-2 font-semibold">Stage</th>
                    <th className="px-4 py-2 font-semibold">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const meta = getStatusMeta(row.crmStatus)
                    return (
                      <tr key={row.leadId} className="border-t border-gray-50 hover:bg-gray-50/80">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              onNavigate?.('pipeline')
                              openPipelineLead(row.leadId, 'overview')
                            }}
                            className="font-medium text-gray-900 hover:text-teal-800 hover:underline text-left"
                          >
                            {row.name}
                          </button>
                          <p className="text-[11px] text-gray-500">{row.company}</p>
                          {row.tradingProfile?.customerCode && (
                            <p className="text-[10px] text-gray-400 font-mono">
                              {row.tradingProfile.customerCode}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{row.phone || '—'}</td>
                        <td className="px-4 py-3 text-xs">{formatIsoDate(row.firstShipmentAt)}</td>
                        <td className="px-4 py-3 text-xs">{formatIsoDate(row.lastShipmentAt)}</td>
                        <td className="px-4 py-3 text-center tabular-nums">{row.shipmentCount || 0}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {assigneeName(row.assignedToUserId)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.some((r) => r.tradingProfile?.shipments?.length > 1) && (
            <p className="text-[10px] text-gray-400 px-4 py-2 border-t">
              Open a lead in Pipeline → Overview for full shipment history and notes.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] font-semibold uppercase text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${accent || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
