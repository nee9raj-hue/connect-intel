import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
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
      const data = isCompany
        ? await api.importOrgPipeline({ datasetType, rows, addToPipeline })
        : await api.importMyPipeline({ datasetType, rows, addToPipeline })
      setRows([])
      setFileName('')
      setMessage(data.message || 'Import complete')
      await refreshSavedLeads()
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
          <p className="text-xs text-gray-600 leading-relaxed">
            Upload your existing Excel/CSV. Columns should match our template (company, first_name, email, phone,
            pipeline_status, notes…).{' '}
            {isCompany
              ? 'Company imports go to your team pipeline (members get leads assigned to them).'
              : 'Imports go to your personal pipeline.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadImportTemplateCsv}
              className="text-xs font-semibold px-3 py-1.5 border rounded-md"
            >
              Download CSV template
            </button>
            <button
              type="button"
              onClick={downloadImportTemplateXlsx}
              className="text-xs font-semibold px-3 py-1.5 border rounded-md"
            >
              Download Excel template
            </button>
          </div>

          <p className="text-[10px] text-gray-400 font-mono break-all">{IMPORT_TEMPLATE_COLUMNS.join(', ')}</p>

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

          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="w-full text-xs" />
          {fileName && <p className="text-xs text-gray-500">{fileName}</p>}

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={addToPipeline} onChange={(e) => setAddToPipeline(e.target.checked)} />
            Add imported contacts to CRM pipeline
          </label>

          {message && <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">{message}</p>}
          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{error}</p>}

          <button
            type="button"
            disabled={loading || !rows.length}
            onClick={handleUpload}
            className="w-full py-2.5 bg-[#ffcb2b] text-[#242424] font-semibold rounded-lg disabled:opacity-50"
          >
            {loading ? 'Importing…' : `Import ${rows.length || 0} rows`}
          </button>
        </div>
      </div>
    </div>
  )
}
