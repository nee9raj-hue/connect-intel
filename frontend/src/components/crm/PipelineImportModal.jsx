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
  'block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#FF773D] file:text-[#242424] hover:file:bg-[#e5652f]'

export default function PipelineImportModal({ open, onClose, onImported }) {
  const { user, refreshSavedLeads, orgLeadTags, refreshOrgLeadTags } = useApp()
  const isCompany = user?.accountType === 'company' && user?.organizationId
  const [datasetType, setDatasetType] = useState('general')
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [addToPipeline, setAddToPipeline] = useState(true)
  const [importTagIds, setImportTagIds] = useState([])

  const preview = useMemo(() => summarizeImportRows(rows), [rows])

  useEffect(() => {
    if (open && isCompany) refreshOrgLeadTags?.()
  }, [open, isCompany, refreshOrgLeadTags])

  useEffect(() => {
    if (!open) {
      setRows([])
      setFileName('')
      setMessage('')
      setError('')
      setImportTagIds([])
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
        ? await api.importOrgPipeline({
            datasetType,
            rows: importRows,
            addToPipeline,
            tagIds: importTagIds,
          })
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
    <div
      className="crm-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="crm-modal-header">
          <h2>Import pipeline</h2>
          <button type="button" onClick={onClose} className="crm-modal-close" aria-label="Close">
            ×
          </button>
        </header>
        <div className="crm-modal-body crm-modal-body-padded space-y-4 text-sm">
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

          {isCompany && orgLeadTags?.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Lead tags for this import (optional)
              </label>
              <select
                multiple
                value={importTagIds}
                onChange={(e) => setImportTagIds([...e.target.selectedOptions].map((o) => o.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm min-h-[4.25rem]"
              >
                {orgLeadTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1">Cmd/Ctrl-click to select multiple. Merged with sheet column lead_tags.</p>
            </div>
          )}

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

        </div>
        <footer className="crm-modal-footer">
          <button
            type="button"
            disabled={loading || !preview.withCompany}
            onClick={handleUpload}
            className="crm-btn crm-btn-primary w-full sm:w-auto bg-[#FF773D] text-[#242424] border-[#FF773D] hover:bg-[#e5652f]"
          >
            {loading
              ? 'Importing…'
              : `4. Import ${preview.withCompany || 0} row${preview.withCompany === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </div>
  )
}
