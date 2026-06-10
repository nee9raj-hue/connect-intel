import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { parseUploadFile, summarizeImportRows } from '../../lib/parseUpload'
import {
  downloadImportTemplateCsv,
  downloadImportTemplateXlsx,
} from '../../lib/importTemplate'

const DATASET_OPTIONS = [
  { id: 'exporters', label: 'Exporters' },
  { id: 'shipping', label: 'Shipping / Logistics' },
  { id: 'general', label: 'General' },
]

function ImportResultCard({ stats, job, fileLabel }) {
  if (!stats && !job) return null
  const created = job?.createdCount ?? stats?.pipelineAdded ?? 0
  const updated = job?.updatedCount ?? stats?.pipelineUpdated ?? 0
  const skipped = job?.skippedCount ?? stats?.pipelineSkipped ?? 0
  const errors = job?.errorCount ?? stats?.rejectedRows ?? 0

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 space-y-2">
      <p className="text-sm font-semibold text-emerald-950">Import complete{fileLabel ? ` — ${fileLabel}` : ''}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded-lg bg-white/80 px-2 py-2">
          <p className="text-lg font-bold text-gray-900 tabular-nums">{created}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Created</p>
        </div>
        <div className="rounded-lg bg-white/80 px-2 py-2">
          <p className="text-lg font-bold text-gray-900 tabular-nums">{updated}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Updated</p>
        </div>
        <div className="rounded-lg bg-white/80 px-2 py-2">
          <p className="text-lg font-bold text-gray-900 tabular-nums">{skipped}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Skipped</p>
        </div>
        <div className="rounded-lg bg-white/80 px-2 py-2">
          <p className="text-lg font-bold text-gray-900 tabular-nums">{errors}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Errors</p>
        </div>
      </div>
      {job?.id && (
        <p className="text-[10px] text-gray-500 font-mono">Job {job.id.slice(0, 8)}… · {job.status}</p>
      )}
    </div>
  )
}

export default function OrgPipelineImport({ onImported, embedded = false }) {
  const { orgLeadTags, refreshOrgLeadTags } = useApp()
  const [datasetType, setDatasetType] = useState('exporters')
  const [overview, setOverview] = useState(null)
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [addToPipeline, setAddToPipeline] = useState(true)
  const [importTagIds, setImportTagIds] = useState([])
  const [lastResult, setLastResult] = useState(null)

  const loadOverview = async () => {
    try {
      const data = await api.getOrgImportOverview()
      setOverview(data)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadOverview()
  }, [])

  useEffect(() => {
    refreshOrgLeadTags?.()
  }, [refreshOrgLeadTags])

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setMessage('')
    setLastResult(null)
    try {
      const parsedRows = await parseUploadFile(file)
      const summary = summarizeImportRows(parsedRows)
      setRows(summary.rows)
      setFileName(file.name)
      if (!summary.total) {
        setError('No data rows found. Use the Excel "Data" sheet or CSV with a company column.')
        return
      }
      if (!summary.withCompany) {
        setError(
          `Found ${summary.total} row(s) but none have a company name. Use the "company" column from the template.`
        )
        return
      }
      setMessage(
        `Loaded ${summary.total} row(s) — ${summary.withCompany} ready to import from ${file.name}.`
      )
    } catch (err) {
      setRows([])
      setFileName('')
      setError(err.message || 'Could not parse file')
    }
  }

  const handleUpload = async () => {
    if (!rows.length) return
    setLoading(true)
    setError('')
    setMessage('')
    setLastResult(null)
    const importedFileName = fileName
    try {
      const importRows = rows.filter((r) =>
        Boolean(String(r.company || r.business_name || r.company_name || '').trim())
      )
      const data = await api.importOrgPipeline({
        datasetType,
        rows: importRows,
        addToPipeline,
        tagIds: importTagIds,
        filename: importedFileName || 'pipeline-import.csv',
      })
      setOverview(data)
      setRows([])
      setFileName('')

      let job = null
      if (data.jobId) {
        try {
          const statusRes = await api.getOrgImportStatus(data.jobId)
          job = statusRes.job
        } catch {
          // job row optional
        }
      }

      setLastResult({ stats: data.stats, job, fileName: importedFileName })
      setMessage(data.message || 'Import complete.')
      onImported?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const body = (
    <div className={`space-y-4 ${embedded ? '' : 'p-5'}`}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadImportTemplateXlsx()}
            className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Download Excel template
          </button>
          <button
            type="button"
            onClick={() => downloadImportTemplateCsv()}
            className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Download CSV template
          </button>
        </div>

        {overview && (
          <p className="text-xs text-gray-600">
            <strong>{overview.pipelineCount?.toLocaleString() || 0}</strong> leads in your pipeline
          </p>
        )}

        {lastResult && (
          <ImportResultCard stats={lastResult.stats} job={lastResult.job} fileLabel={lastResult.fileName} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-gray-600">Dataset type</label>
          <select
            value={datasetType}
            onChange={(e) => setDatasetType(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5"
          >
            {DATASET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={addToPipeline}
              onChange={(e) => setAddToPipeline(e.target.checked)}
              className="rounded"
            />
            Add to CRM pipeline
          </label>
        </div>

        {orgLeadTags?.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Apply lead tags (optional — hold Cmd/Ctrl to select several)
            </label>
            <select
              multiple
              value={importTagIds}
              onChange={(e) => {
                const next = [...e.target.selectedOptions].map((o) => o.value)
                setImportTagIds(next)
              }}
              className="w-full max-w-md text-sm border border-gray-200 rounded-md px-2 py-1.5 min-h-[4.5rem]"
            >
              {orgLeadTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#FF773D] file:text-[#242424] hover:file:bg-[#e5652f]"
        />
        {fileName && <p className="text-xs text-gray-500">{fileName}</p>}

        <button
          type="button"
          onClick={handleUpload}
          disabled={!rows.length || loading}
          className="px-4 py-2 bg-[#FF773D] hover:bg-[#e5652f] text-[#242424] text-sm font-semibold rounded-lg disabled:opacity-50"
        >
          {loading ? 'Importing…' : `Import ${rows.length || ''} row${rows.length === 1 ? '' : 's'}`}
        </button>

        <p className="text-xs text-gray-500">
          Template columns include optional <code className="text-gray-700">assignee_email</code>,{' '}
          <code className="text-gray-700">team_leader</code>, <code className="text-gray-700">lead_tags</code>,{' '}
          <code className="text-gray-700">pipeline_status</code>, <code className="text-gray-700">notes</code>.
          Same email or phone as an existing lead updates that lead instead of creating a duplicate.
        </p>

        {message && (
          <p className="text-xs text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            {message}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          Upload CSV or Excel — leads go to your team pipeline. Download a template first for best column mapping.
        </p>
        {body}
      </div>
    )
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Import your pipeline</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Upload your existing leads (CSV or Excel). They are added to your team pipeline for follow-up,
          email, and closures. Use our template columns for best results.
        </p>
      </div>
      {body}
    </section>
  )
}
