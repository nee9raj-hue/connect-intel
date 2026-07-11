import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { parseUploadFile } from '../../lib/parseUpload'
import {
  IMPORT_TEMPLATE_COLUMNS,
  downloadImportTemplateCsv,
  downloadImportTemplateXlsx,
} from '../../lib/importTemplate'
import { useApp } from '../../context/AppContext'
import InviteEmailSetup from '../team/InviteEmailSetup'
import OrgWhatsAppCloudSetup from '../team/OrgWhatsAppCloudSetup'
import { IMPORT_UPLOAD_CHUNK_ROWS, prepareImportUploadRows } from '../../lib/importUploadPrep'
import PlatformOperatorGate from './PlatformOperatorGate'

const DATASET_OPTIONS = [
  { id: 'exporters', label: 'Exporters' },
  { id: 'shipping', label: 'Shipping / Logistics' },
  { id: 'general', label: 'General companies' },
]

export default function AdminPanel({ onNavigate }) {
  const { user } = useApp()
  const [datasetType, setDatasetType] = useState('exporters')
  const [overview, setOverview] = useState(null)
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [researchKeywords, setResearchKeywords] = useState('exporter')
  const [researchState, setResearchState] = useState('Rajasthan')
  const [researchCities, setResearchCities] = useState('Jaipur, Jodhpur, Udaipur')
  const [researchResults, setResearchResults] = useState([])
  const [researchLoading, setResearchLoading] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [dedupeLoading, setDedupeLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!user?.isPlatformAdmin) return
      try {
        const data = await api.getAdminOverview()
        if (!cancelled) setOverview(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setMessage('')

    try {
      const parsedRows = await parseUploadFile(file)
      setRows(parsedRows)
      setFileName(file.name)
      setMessage(`Loaded ${parsedRows.length} row${parsedRows.length === 1 ? '' : 's'} from ${file.name}`)
    } catch (err) {
      setRows([])
      setFileName('')
      setError(err.message || 'Could not parse file')
    }
  }

  const handlePerplexityResearch = async () => {
    setResearchLoading(true)
    setError('')
    setMessage('')

    try {
      const cities = researchCities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
      const data = await api.researchLeads(
        {
          keywords: researchKeywords,
          states: researchState ? [researchState] : [],
          cities,
          jobTitles: [],
          industries: [],
          companySizes: [],
        },
        12
      )
      setResearchResults(data.leads || [])
      setMessage(data.notice || `Found ${data.leads?.length || 0} AI-suggested companies`)
      if (data.error) setError(data.error)
    } catch (err) {
      setResearchResults([])
      setError(err.message)
    } finally {
      setResearchLoading(false)
    }
  }

  const uploadChunkWithRetry = async (payload, attempt = 0) => {
    try {
      return await api.createImport(payload)
    } catch (err) {
      if (attempt < 1 && /timed out|timeout|522|503|504/i.test(err.message || '')) {
        await new Promise((r) => setTimeout(r, 1500))
        return uploadChunkWithRetry(payload, attempt + 1)
      }
      throw err
    }
  }

  const handleDedupe = async () => {
    if (!window.confirm('Remove duplicate companies and contacts from the master database? This cannot be undone.')) {
      return
    }
    setDedupeLoading(true)
    setError('')
    setMessage('')
    try {
      const data = await api.dedupeMasterDatabase()
      setOverview(data)
      const d = data.dedupe || {}
      setMessage(
        `Removed ${d.companiesRemoved || 0} duplicate companies and ${d.contactsRemoved || 0} duplicate contacts. ` +
          `Database now has ${d.companiesLeft || 0} companies and ${d.contactsLeft || 0} contacts.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setDedupeLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!rows.length) return

    setLoading(true)
    setError('')
    setMessage('')

    const { rows: slimRows } = prepareImportUploadRows(rows)
    if (!slimRows.length) {
      setError('No valid rows to import after cleaning the file.')
      setLoading(false)
      return
    }

    const chunks = []
    for (let i = 0; i < slimRows.length; i += IMPORT_UPLOAD_CHUNK_ROWS) {
      chunks.push(slimRows.slice(i, i + IMPORT_UPLOAD_CHUNK_ROWS))
    }

    try {
      let importJobId = null
      let lastOverview = null
      for (let i = 0; i < chunks.length; i += 1) {
        setImportProgress({ current: i + 1, total: chunks.length, rows: slimRows.length })
        const data = await uploadChunkWithRetry({
          datasetType,
          rows: chunks[i],
          importJobId,
          chunkIndex: i,
          done: i === chunks.length - 1,
        })
        if (!importJobId && data.importJobId) importJobId = data.importJobId
        if (data.imports || data.counts) lastOverview = data
        if (i < chunks.length - 1) {
          await new Promise((r) => setTimeout(r, 400))
        }
      }
      if (!lastOverview?.counts) {
        lastOverview = await api.getAdminOverview()
      }
      if (lastOverview) setOverview(lastOverview)
      const imported = lastOverview?.importJob?.rowCount || slimRows.length
      setRows([])
      setFileName('')
      setMessage(
        chunks.length > 1
          ? `Imported ${imported} rows in ${chunks.length} batches into ${datasetType}`
          : `Imported ${imported} rows into ${datasetType}`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setImportProgress(null)
    }
  }

  if (!user?.isPlatformAdmin) {
    return <PlatformOperatorGate onNavigate={onNavigate} />
  }

  return (
    <div className="panel-shell">
      <div className="panel-body-scroll p-6">
      <div className="mb-6 rounded-2xl border border-gray-900 bg-gray-900 text-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF773D]">Platform operator</p>
        <h1 className="text-xl font-semibold mt-1">Master data & imports</h1>
        <p className="text-sm text-gray-300 mt-2 max-w-2xl">
          Upload exporter and contact sheets here. All customer searches use this shared database. Customer
          company admins only manage their own team pipeline under Team — not this screen.
        </p>
      </div>

      <section className="mb-6 bg-white rounded-2xl border border-[#ffd4b8] p-5 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900">Team invite email (all customers)</h2>
        <p className="text-xs text-gray-500 mt-1 mb-3 leading-relaxed">
          Connect once as <strong>invite@connectintel.net</strong>. Every company admin can then send team invites
          without DNS.
        </p>
        <InviteEmailSetup />
      </section>

      <section className="mb-6 bg-white rounded-2xl border border-[#25D366]/40 p-5 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900">WhatsApp Business API (automatic bulk send)</h2>
        <p className="text-xs text-gray-500 mt-1 mb-3 leading-relaxed">
          Platform-wide default for marketing campaigns and pipeline bulk WhatsApp. Customers can override with
          their own number under <strong>Team</strong>.
        </p>
        <OrgWhatsAppCloudSetup scope="platform" />
      </section>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard label="Companies" value={overview?.counts?.companies ?? 0} />
        <StatCard label="Contacts" value={overview?.counts?.contacts ?? 0} />
        <StatCard label="Imports" value={overview?.counts?.imports ?? 0} />
      </div>

      <section className="mb-6 bg-white rounded-2xl border border-amber-200 p-5 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900">Clean master database</h2>
        <p className="text-xs text-gray-500 mt-1 mb-3 leading-relaxed">
          Run this before large imports if uploads time out or search shows duplicate companies. Merges rows with the
          same domain or company + city + state.
        </p>
        <button
          type="button"
          onClick={handleDedupe}
          disabled={dedupeLoading || loading}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
        >
          {dedupeLoading ? 'Removing duplicates…' : 'Remove duplicate entries'}
        </button>
      </section>

      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900">Import dataset</h2>
          <p className="mt-1 text-sm text-gray-500">
            Download the template first so every upload uses the same columns. Customers then see
            consistent company and contact fields in search results.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadImportTemplateXlsx()}
              className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
            >
              Download Excel template
            </button>
            <button
              type="button"
              onClick={() => downloadImportTemplateCsv()}
              className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
            >
              Download CSV template
            </button>
          </div>

          <details className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <summary className="text-sm font-semibold text-gray-800 cursor-pointer">
              Required columns ({IMPORT_TEMPLATE_COLUMNS.length})
            </summary>
            <p className="mt-2 text-xs text-gray-600">
              <strong className="text-gray-800">company</strong> is required on every row. Add contact
              columns for unlockable email and phone in search. Do not rename headers.
            </p>
            <p className="mt-2 text-xs text-gray-500 font-mono leading-relaxed break-all">
              {IMPORT_TEMPLATE_COLUMNS.join(' · ')}
            </p>
          </details>

          <div className="mt-5 flex flex-wrap gap-2">
            {DATASET_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDatasetType(option.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  datasetType === option.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="mt-5 block rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center cursor-pointer hover:border-gray-400">
            <input type="file" accept=".xlsx,.xls,.csv,.json" className="hidden" onChange={handleFileChange} />
            <div className="text-sm font-medium text-gray-800">Choose Excel, CSV, or JSON</div>
            <div className="mt-1 text-xs text-gray-500">
              {fileName || 'Exporter lists, shipping companies, or contact datasets'}
            </div>
          </label>

          {rows.length > 0 && (
            <div className="mt-4 rounded-xl border border-gray-200 p-4 bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">
                Ready to import {rows.length} row{rows.length === 1 ? '' : 's'}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Columns detected: {Object.keys(rows[0] || {}).slice(0, 8).join(', ') || 'none'}
              </div>
            </div>
          )}

          {importProgress ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-900">
                Uploading batch {importProgress.current} of {importProgress.total} ({importProgress.rows} rows total)…
              </p>
              <div className="mt-2 h-2 rounded-full bg-blue-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!rows.length || loading}
            className="mt-5 px-4 py-2 bg-[#FF773D] hover:bg-[#e5652f] text-[#242424] text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {loading
              ? importProgress
                ? `Importing batch ${importProgress.current}/${importProgress.total}…`
                : 'Importing…'
              : rows.length > IMPORT_UPLOAD_CHUNK_ROWS
                ? `Import ${rows.length} rows (${Math.ceil(rows.length / IMPORT_UPLOAD_CHUNK_ROWS)} batches)`
                : 'Import dataset'}
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900">Recent imports</h2>
          <div className="mt-4 space-y-3">
            {(overview?.imports || []).length === 0 ? (
              <p className="text-sm text-gray-500">No imports yet.</p>
            ) : (
              overview.imports.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900">{item.datasetType}</div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {item.rowCount} rows · {item.companiesCreated} companies · {item.contactsCreated} contacts
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900">AI research</h2>
        <p className="mt-1 text-sm text-gray-500">
          Discover companies on the web when your database is thin. Verify contacts, then import via Excel.
          Customer search also uses live AI automatically when no database matches.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={researchKeywords}
            onChange={(e) => setResearchKeywords(e.target.value)}
            placeholder="Keywords e.g. exporter"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            type="text"
            value={researchState}
            onChange={(e) => setResearchState(e.target.value)}
            placeholder="State e.g. Rajasthan"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            type="text"
            value={researchCities}
            onChange={(e) => setResearchCities(e.target.value)}
            placeholder="Cities comma-separated"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handlePerplexityResearch}
          disabled={researchLoading}
          className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
        >
          {researchLoading ? 'Researching…' : 'Run AI research'}
        </button>
        {researchResults.length > 0 && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-violet-100/80 text-left text-xs uppercase text-violet-900">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Title</th>
                </tr>
              </thead>
              <tbody>
                {researchResults.map((lead) => (
                  <tr key={lead.id} className="border-t border-violet-100">
                    <td className="px-3 py-2">
                      {lead.firstName} {lead.lastName}
                    </td>
                    <td className="px-3 py-2">{lead.company}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {[lead.city, lead.state].filter(Boolean).join(', ')}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{lead.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-4 bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900">Latest records</h2>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <MiniTable
            title="Companies"
            rows={overview?.recentCompanies || []}
            render={(item) => (
              <>
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-xs text-gray-500">
                  {[item.city, item.state, item.industry].filter(Boolean).join(' · ')}
                </div>
              </>
            )}
          />
          <MiniTable
            title="Contacts"
            rows={overview?.recentContacts || []}
            render={(item) => (
              <>
                <div className="font-medium text-gray-900">
                  {[item.firstName, item.lastName].filter(Boolean).join(' ') || item.fullName || 'Contact'}
                </div>
                <div className="text-xs text-gray-500">
                  {[item.title, item.email].filter(Boolean).join(' · ')}
                </div>
              </>
            )}
          />
        </div>
      </section>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold text-gray-900 mt-2">{value}</div>
    </div>
  )
}

function MiniTable({ title, rows, render }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-800">{title}</div>
      <div className="divide-y divide-gray-100">
        {rows.length === 0 ? (
          <div className="px-4 py-4 text-sm text-gray-500">No records yet.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="px-4 py-3 text-sm">
              {render(row)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
