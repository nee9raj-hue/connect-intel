import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { parseUploadFile } from '../../lib/parseUpload'
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

export default function OrgPipelineImport({ onImported }) {
  const [datasetType, setDatasetType] = useState('exporters')
  const [overview, setOverview] = useState(null)
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [addToPipeline, setAddToPipeline] = useState(true)

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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setMessage('')
    try {
      const parsedRows = await parseUploadFile(file)
      setRows(parsedRows)
      setFileName(file.name)
      setMessage(`Loaded ${parsedRows.length} row(s) from ${file.name}`)
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
    try {
      const data = await api.importOrgPipeline({ datasetType, rows, addToPipeline })
      setOverview(data)
      setRows([])
      setFileName('')
      setMessage(
        data.message ||
          `Imported ${data.stats?.contactsCreated || 0} contacts · ${data.stats?.pipelineAdded || 0} in pipeline`
      )
      onImported?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Import your pipeline</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Upload your existing leads (CSV or Excel). Contacts are saved to Connect Intel master data and
          added to your team Pipeline for follow-up and closures. Rows with email and phone appear in
          People search for your org.
        </p>
      </div>

      <div className="p-5 space-y-4">
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
            Master DB: {overview.counts?.contacts?.toLocaleString() || 0} contacts · Pipeline:{' '}
            <strong>{overview.pipelineCount || 0}</strong> leads
          </p>
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

        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-800 hover:file:bg-gray-200"
        />
        {fileName && <p className="text-xs text-gray-500">{fileName}</p>}

        <button
          type="button"
          onClick={handleUpload}
          disabled={!rows.length || loading}
          className="px-4 py-2 bg-[#ffcb2b] hover:bg-[#f0bc00] text-[#242424] text-sm font-semibold rounded-lg disabled:opacity-50"
        >
          {loading ? 'Importing…' : `Import ${rows.length || ''} row${rows.length === 1 ? '' : 's'}`}
        </button>

        <p className="text-[11px] text-gray-500">
          Template columns: {IMPORT_TEMPLATE_COLUMNS.slice(0, 8).join(', ')}… plus optional{' '}
          <code className="text-gray-700">pipeline_status</code>, <code className="text-gray-700">notes</code>.
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
    </section>
  )
}
