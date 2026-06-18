import { useEffect, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { parseUploadFile, summarizeImportRows } from '../../../lib/parseUpload'
import { C } from './settingsTheme'
import { PrimaryButton, SettingsCard, SettingsSelect, TextButton } from './SettingsUi'

const CRM_FIELDS = [
  { id: 'skip', label: 'Skip this column' },
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'company', label: 'Company' },
  { id: 'stage', label: 'Stage' },
  { id: 'owner', label: 'Owner' },
  { id: 'tags', label: 'Tags' },
  { id: 'custom', label: 'Custom field' },
]

const STEPS = ['Upload file', 'Map columns', 'Review & import']

function applyColumnMapping(rows, mapping) {
  return rows.map((row) => {
    const out = { ...row }
    for (const [header, field] of Object.entries(mapping || {})) {
      if (!field || field === 'skip') continue
      const raw = row[header]
      if (raw == null || !String(raw).trim()) continue
      const value = String(raw).trim()
      if (field === 'tags') {
        out.tags = out.tags ? `${out.tags}, ${value}` : value
        out.lead_tags = out.lead_tags ? `${out.lead_tags}, ${value}` : value
      } else if (field === 'name') {
        out.contact_name = value
      } else if (field === 'email') {
        out.email = value
      } else if (field === 'phone') {
        out.phone = value
      } else if (field === 'company') {
        out.company = value
      } else if (field === 'stage') {
        out.pipeline_status = value
      } else if (field === 'owner') {
        out.assignee_email = value
      }
    }
    return out
  })
}

export default function ImportLeadsTab({ onImported, onNavigate }) {
  const [step, setStep] = useState(0)
  const [recent, setRecent] = useState([])
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [fileName, setFileName] = useState('')
  const [duplicateMode, setDuplicateMode] = useState('skip')
  const [matchBy, setMatchBy] = useState('email')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)
  const pollRef = useRef(null)

  const loadRecent = async () => {
    try {
      const data = await api.getOrgImportOverview()
      setRecent((data?.recentJobs || data?.jobs || []).slice(0, 5))
    } catch {
      setRecent([])
    }
  }

  useEffect(() => {
    loadRecent()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleFile = async (file) => {
    if (!file) return
    setError(null)
    setResult(null)
    try {
      const parsed = await parseUploadFile(file)
      const summary = summarizeImportRows(parsed)
      if (!summary.total) {
        setError('No data rows found.')
        return
      }
      const hdrs = Object.keys(summary.rows[0] || {})
      setHeaders(hdrs)
      const autoMap = {}
      for (const h of hdrs) {
        const low = h.toLowerCase()
        if (low.includes('company') || low.includes('name')) autoMap[h] = 'company'
        else if (low.includes('email')) autoMap[h] = 'email'
        else if (low.includes('phone') || low.includes('mobile')) autoMap[h] = 'phone'
        else if (low.includes('stage') || low.includes('status')) autoMap[h] = 'stage'
        else if (low.includes('tag')) autoMap[h] = 'tags'
        else if (low.includes('owner') || low.includes('assignee')) autoMap[h] = 'owner'
        else autoMap[h] = 'skip'
      }
      setMapping(autoMap)
      setRows(summary.rows)
      setFileName(file.name)
      setStep(1)
    } catch (err) {
      setError(err.message)
    }
  }

  const startImport = async () => {
    setImporting(true)
    setError(null)
    setStep(2)
    try {
      const data = await api.importOrgPipeline({
        datasetType: 'general',
        rows: applyColumnMapping(rows, mapping),
        addToPipeline: true,
        filename: fileName,
      })
      const jobId = data?.jobId || data?.job?.id
      if (jobId) {
        setProgress({ status: 'running', pct: 10 })
        pollRef.current = setInterval(async () => {
          try {
            const { job } = await api.getOrgImportStatus(jobId)
            if (!job) return
            const total = job.totalRows || rows.length
            const done = (job.createdCount || 0) + (job.updatedCount || 0) + (job.skippedCount || 0) + (job.errorCount || 0)
            setProgress({
              status: job.status,
              pct: total ? Math.min(99, Math.round((done / total) * 100)) : 50,
            })
            if (job.status === 'completed' || job.status === 'failed') {
              clearInterval(pollRef.current)
              setResult(job)
              setImporting(false)
              setProgress({ status: 'completed', pct: 100 })
              await loadRecent()
              onImported?.()
            }
          } catch {
            // keep polling
          }
        }, 2000)
      } else {
        setResult({
          createdCount: data?.pipelineAdded ?? data?.created ?? rows.length,
          updatedCount: data?.pipelineUpdated ?? 0,
          skippedCount: data?.pipelineSkipped ?? 0,
          status: 'completed',
        })
        setImporting(false)
        await loadRecent()
        onImported?.()
      }
    } catch (err) {
      setError(err.message)
      setImporting(false)
    }
  }

  const previewRows = rows.slice(0, 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: i <= step ? C.accent : '#e8e8e6',
                  color: i <= step ? '#fff' : C.textMuted,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 12, color: i === step ? C.text : C.textMuted, fontWeight: i === step ? 500 : 400 }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: C.border, margin: '0 12px' }} />}
          </div>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#791f1f', background: '#fcebeb', padding: 12, borderRadius: 8, margin: 0 }}>{error}</p>
      )}

      {step === 0 && (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFile(e.dataTransfer.files?.[0])
            }}
          >
          <SettingsCard style={{ borderStyle: 'dashed', textAlign: 'center', padding: 48 }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 8px' }}>Drop your CSV or Excel file here</p>
            <TextButton onClick={() => fileRef.current?.click()}>or browse files</TextButton>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
            <p style={{ fontSize: 12, color: C.textMuted, margin: '16px 0 0' }}>
              First row must be headers · Max 10,000 rows · CSV or .xlsx
            </p>
          </SettingsCard>
          </div>

          {recent.length > 0 && (
            <SettingsCard style={{ padding: 0, overflow: 'hidden' }}>
              <p style={{ fontSize: 13, fontWeight: 500, padding: '16px 16px 8px', margin: 0 }}>Recent imports</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9f9f7', color: C.textMuted, textTransform: 'uppercase', fontSize: 11 }}>
                    <th style={{ textAlign: 'left', padding: '8px 16px' }}>File</th>
                    <th style={{ textAlign: 'left', padding: '8px 16px' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 16px' }}>Results</th>
                    <th style={{ textAlign: 'left', padding: '8px 16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((job) => (
                    <tr key={job.id} style={{ borderTop: `0.5px solid ${C.border}` }}>
                      <td style={{ padding: '10px 16px' }}>{job.filename || job.fileName || '—'}</td>
                      <td style={{ padding: '10px 16px', color: C.textSecondary }}>{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '10px 16px', color: C.textSecondary }}>
                        {(job.createdCount ?? 0)} / {(job.updatedCount ?? 0)} / {(job.skippedCount ?? 0)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>{job.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SettingsCard>
          )}
        </>
      )}

      {step === 1 && (
        <SettingsCard>
          <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 16px' }}>Map columns — {fileName}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {headers.map((h) => (
              <div key={h} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.text }}>{h}</span>
                <SettingsSelect value={mapping[h] || 'skip'} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}>
                  {CRM_FIELDS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </SettingsSelect>
              </div>
            ))}
          </div>
          {previewRows.length > 0 && (
            <div style={{ overflow: 'auto', border: `0.5px solid ${C.border}`, borderRadius: 8, marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f9f9f7' }}>
                    {headers.map((h) => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {headers.map((h) => (
                        <td key={h} style={{ padding: '6px 10px', borderTop: `0.5px solid ${C.border}` }}>{String(row[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <TextButton onClick={() => setStep(0)}>Back</TextButton>
            <PrimaryButton onClick={() => setStep(2)}>Continue</PrimaryButton>
          </div>
        </SettingsCard>
      )}

      {step === 2 && (
        <SettingsCard>
          <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 8px' }}>Ready to import {rows.length} leads</p>
          <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 16px' }}>From {fileName}</p>

          <p style={{ fontSize: 12, fontWeight: 500, margin: '0 0 8px' }}>Duplicate handling</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, fontSize: 12 }}>
            {[
              { id: 'skip', label: 'Skip duplicates' },
              { id: 'update', label: 'Update existing' },
              { id: 'create', label: 'Create anyway' },
            ].map((opt) => (
              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="dup" checked={duplicateMode === opt.id} onChange={() => setDuplicateMode(opt.id)} />
                {opt.label}
              </label>
            ))}
            <SettingsSelect value={matchBy} onChange={(e) => setMatchBy(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="email">Match by Email</option>
              <option value="phone">Match by Phone</option>
            </SettingsSelect>
          </div>

          {importing && progress && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 8, background: '#e8e8e6', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress.pct}%`, background: C.accent, transition: 'width 0.3s' }} />
              </div>
              <p style={{ fontSize: 12, color: C.textMuted, margin: '8px 0 0' }}>Importing… {progress.pct}%</p>
            </div>
          )}

          {result && (
            <div style={{ padding: 16, background: '#eaf3de', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              ✓ {(result.createdCount ?? 0)} created · {(result.updatedCount ?? 0)} updated · {(result.skippedCount ?? 0)} skipped
              <div style={{ marginTop: 8 }}>
                <TextButton onClick={() => onNavigate?.('pipeline')}>View in pipeline →</TextButton>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {!result && (
              <>
                <TextButton onClick={() => setStep(1)} disabled={importing}>Back</TextButton>
                <PrimaryButton onClick={startImport} disabled={importing}>
                  {importing ? 'Importing…' : 'Start import'}
                </PrimaryButton>
              </>
            )}
          </div>
        </SettingsCard>
      )}
    </div>
  )
}
