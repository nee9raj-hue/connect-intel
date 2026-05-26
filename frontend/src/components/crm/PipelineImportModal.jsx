import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { parseUploadFile, summarizeImportRows } from '../../lib/parseUpload'
import {
  IMPORT_TEMPLATE_COLUMNS,
  downloadImportTemplateCsv,
  downloadImportTemplateXlsx,
} from '../../lib/importTemplate'

const DATASET_OPTIONS = [
  { id: 'exporters', label: 'Exporters' },
  { id: 'shipping', label: 'Shipping / Logistics' },
  { id: 'general', label: 'General' },
]

const FILE_INPUT_CLASS =
  'block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#ffcb2b] file:text-[#242424] hover:file:bg-[#f0bc00]'

export default function PipelineImportModal({ open, onClose, onImported }) {
  const { user, refreshSavedLeads } = useApp()
  const isCompany = user?.accountType === 'company' && user?.organizationId
  const [datasetType, setDatasetType] = useState('general')
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [addToPipeline, setAddToPipeline] = useState(true)

  const preview = useMemo(() => summarizeImportRows(rows), [rows])

  useEffect(() => {
    if (!open) {
      setRows([])
      setFileName('')
      setMessage('')
      setError('')
    }
  }, [open])

  if (!open) return null

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setMessage('')
    try {
      const parsedRows = await parseUploadFile(file)
      const summary = summarizeImportRows(parsedRows)
      setRows(summary.rows)
      setFileName(file.name)
      if (!summary.total) {
        setError('No data rows found. Use our template and keep the header row (company, first_name, email…).')
        return
      }
      if (!summary.withCompany) {
        setError(
          `Found ${summary.total} row(s) but none have a company name. Add a "company" column (or Company Name) with a value on each row.`
        )
        return
      }
      setMessage(
        `Loaded ${summary.total} row(s) — ${summary.withCompany} with a company name ready to import.`
      )
    } catch (err) {
      setRows([])
      setFileName('')
      setError(err.message || 'Could not parse file')
    }
  }

  const handleUpload = async () => {
    if (!preview.withCompany) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const importRows = preview.rows.filter((r) =>
        Boolean(String(r.company || r.business_name || r.company_name || '').trim())
      )
      const data = isCompany
        ? await api.importOrgPipeline({ datasetType, rows: importRows, addToPipeline })
        : await api.importMyPipeline({ datasetType, rows: importRows, addToPipeline })
      setRows([])
      setFileName('')
      setMessage(data.message || 'Import complete')
      await refreshSavedLeads({ light: false })
      onImported?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Import pipeline</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
            <li>Download the CSV or Excel template below.</li>
            <li>Fill your leads (required: <strong>company</strong> on every row).</li>
            <li>Choose file → review row count → click Import.</li>
          </ol>

          {user?.accountType === 'company' && !user?.organizationId && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Finish company onboarding before importing to the team pipeline.
            </p>
          )}

          <p className="text-xs text-gray-500 leading-relaxed">
            {isCompany
              ? 'Imports go to your team pipeline. Reps see leads assigned to them; admins see all leads.'
              : 'Imports go to your personal pipeline.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadImportTemplateCsv}
              className="text-xs font-semibold px-3 py-1.5 border rounded-md hover:bg-gray-50"
            >
              1. Download CSV template
            </button>
            <button
              type="button"
              onClick={downloadImportTemplateXlsx}
              className="text-xs font-semibold px-3 py-1.5 border rounded-md hover:bg-gray-50"
            >
              1. Download Excel template
            </button>
          </div>

          <p className="text-[10px] text-gray-400 font-mono break-all">{IMPORT_TEMPLATE_COLUMNS.join(', ')}</p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">2. Dataset type</label>
            <select
              value={datasetType}
              onChange={(e) => setDatasetType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {DATASET_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">3. Choose your file</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className={FILE_INPUT_CLASS}
            />
            {fileName && <p className="mt-1 text-xs text-gray-500">{fileName}</p>}
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={addToPipeline} onChange={(e) => setAddToPipeline(e.target.checked)} />
            Add imported contacts to CRM pipeline
          </label>
          {!addToPipeline && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
              Unchecked: contacts are saved for search only — they will not appear in Pipeline until you add them
              manually.
            </p>
          )}

          {message && (
            <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">
              {message}
            </p>
          )}
          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{error}</p>
          )}

          <button
            type="button"
            disabled={loading || !preview.withCompany}
            onClick={handleUpload}
            className="w-full py-2.5 bg-[#ffcb2b] text-[#242424] font-semibold rounded-lg disabled:opacity-50"
          >
            {loading
              ? 'Importing…'
              : `4. Import ${preview.withCompany || 0} row${preview.withCompany === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
