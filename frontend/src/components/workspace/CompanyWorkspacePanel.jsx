import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { parseWorkspaceUploadFile } from '../../lib/parseUpload'
import { downloadWorkspaceTemplateXlsx } from '../../lib/workspaceImportTemplate'
import { COMPANY_WORKSPACE_GLOBALLY_ENABLED, hasWorkspaceFeature } from '../../lib/workspaceFeatures'
import { formatDealValue } from '../../lib/crmTimeline'
import { DashboardShell, DashboardEmpty, DashboardSection } from '../dashboard/dashboardUi'

const INDUSTRIES = [
  { id: 'logistics_trading', label: 'Logistics & shipping' },
  { id: 'general_crm', label: 'General (custom reports only)' },
]

export default function CompanyWorkspacePanel({ onNavigate }) {
  const { user, updateUser } = useApp()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [pageTitle, setPageTitle] = useState('')
  const [industry, setIndustry] = useState('logistics_trading')
  const [selectedGoals, setSelectedGoals] = useState([])
  const [customNotes, setCustomNotes] = useState('')
  const [step, setStep] = useState('dashboard')

  const enabled = hasWorkspaceFeature(user, 'companyWorkspacePage')
  const displayTitle = pageTitle || user?.workspacePageTitle || 'Company Workspace'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCompanyWorkspace()
      setAnalytics(data.analytics)
      setPageTitle(data.pageTitle || '')
      setIndustry(data.industry || 'logistics_trading')
      const goals = data.analytics?.goals || {}
      setSelectedGoals(goals.selectedQuestionIds || [])
      setCustomNotes(goals.customNotes || '')
      if (!data.hasImport) setStep('setup')
      else if (!data.analytics?.sheetInsights) setStep('analyze')
      else if (!goals.selectedQuestionIds?.length) setStep('goals')
      else setStep('dashboard')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) load()
    else setLoading(false)
  }, [enabled, load])

  const saveMeta = async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.saveCompanyWorkspaceGoals({ pageTitle, industry })
      setAnalytics(data.analytics)
      if (data.user) updateUser(data.user)
      setNotice('Workspace settings saved.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { rows, format, validation } = await parseWorkspaceUploadFile(file)
      if (!validation?.ok) throw new Error(validation.message)
      if (!rows.length) throw new Error('No data rows found in file')
      const data = await api.uploadCompanyWorkspace({ rows, fileName: file.name })
      setAnalytics(data.analytics)
      let extra = ''
      if (format === 'template') extra = ' Template format recognized — reports should build correctly.'
      else if (validation?.pivotWarning) extra = ` ${validation.pivotWarning}`
      else if (format === 'logistics_pivot') {
        extra = ' Pivot converted — for best results use the workspace template next time.'
      }
      setNotice((data.message || 'Upload saved for workspace analytics only — CRM unchanged.') + extra)
      setStep('analyze')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const runAnalyze = async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.analyzeCompanyWorkspace()
      setAnalytics((prev) => ({ ...prev, sheetInsights: data.sheetInsights }))
      const suggested = data.sheetInsights?.suggestedQuestions || []
      const recommended = suggested.filter((q) => q.recommended).map((q) => q.id)
      setSelectedGoals(recommended)
      setStep('goals')
      setNotice('AI reviewed your sheet — confirm what you want in your workspace.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const saveGoals = async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.saveCompanyWorkspaceGoals({
        goals: { selectedQuestionIds: selectedGoals, customNotes },
      })
      setAnalytics(data.analytics)
      setStep('dashboard')
      const blockCount = data.analytics?.report?.blocks?.length || 0
      setNotice(
        blockCount
          ? 'Your workspace report is ready.'
          : 'Saved your choices, but we could not build charts from this sheet. Try a transactional export or change reports.'
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const suggestedQuestions = useMemo(
    () => analytics?.sheetInsights?.suggestedQuestions || [],
    [analytics]
  )

  if (!COMPANY_WORKSPACE_GLOBALLY_ENABLED) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <h2 className="text-lg font-semibold text-[#33475b] mb-2">Workspace temporarily unavailable</h2>
        <p className="text-sm text-[#516f90] mb-4">
          Upload and AI workspace reports are paused while we improve them. Use <strong>Search</strong> and{' '}
          <strong>Pipeline</strong> in the meantime.
        </p>
        <button type="button" className="crm-btn crm-btn-primary" onClick={() => onNavigate?.('search')}>
          Go to Search
        </button>
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <h2 className="text-lg font-semibold text-[#33475b] mb-2">Company workspace not enabled</h2>
        <p className="text-sm text-[#516f90] mb-4">
          Ask your admin to enable <strong>Company workspace page</strong> under Team → Workspace modules,
          or choose the Logistics &amp; shipping preset.
        </p>
        <button type="button" className="crm-btn crm-btn-primary" onClick={() => onNavigate?.('team')}>
          Team settings
        </button>
      </div>
    )
  }

  return (
    <DashboardShell
      title={displayTitle}
      subtitle="Uploads and AI reports live here only — pipeline, tags, and stages stay in CRM."
      actions={
        user?.isOrgAdmin ? (
          <button type="button" className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => onNavigate?.('team')}>
            Workspace settings
          </button>
        ) : null
      }
    >
      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {notice && (
        <p className="text-sm text-green-900 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice}</p>
      )}

      {loading ? (
        <DashboardEmpty>Loading workspace…</DashboardEmpty>
      ) : (
        <>
          {user?.isOrgAdmin && step !== 'dashboard' && (
            <DashboardSection title="Setup" subtitle="Industry and page name for your team">
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[#516f90]">Page title</span>
                  <input
                    value={pageTitle}
                    onChange={(e) => setPageTitle(e.target.value)}
                    placeholder="e.g. Xindus Workspace"
                    className="mt-1 w-full text-sm border border-[#cbd6e2] rounded-md px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[#516f90]">Industry</span>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="mt-1 w-full text-sm border border-[#cbd6e2] rounded-md px-3 py-2"
                  >
                    {INDUSTRIES.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" className="crm-btn crm-btn-secondary crm-btn-sm" disabled={busy} onClick={saveMeta}>
                Save name & industry
              </button>
            </DashboardSection>
          )}

          {(step === 'setup' || step === 'analyze') && user?.isOrgAdmin && (
            <DashboardSection
              title="Upload data"
              subtitle="Download our template first — one row per shipment"
            >
              <p className="text-xs text-[#7c98b6] mb-3 leading-relaxed">
                Reports work reliably when you use the workspace Excel template (columns:{' '}
                <strong>shipment_date</strong>, <strong>shipper</strong>, <strong>final_amount</strong>, plus
                optional shipping_method and sales_leader). This does not change CRM leads or tags.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  className="crm-btn crm-btn-primary crm-btn-sm"
                  onClick={() => downloadWorkspaceTemplateXlsx()}
                >
                  Download Excel template
                </button>
              </div>
              <p className="text-xs text-[#516f90] mb-3 leading-relaxed bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-950">
                Pivot-style exports (Sales lead × Shipper × AE/AN columns) often produce poor charts. Copy
                shipment-level data into the template <strong>Data</strong> sheet instead.
              </p>
              <label className="block text-xs font-semibold text-[#516f90] mb-1">Upload filled template</label>
              <input type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={handleUpload} />
              {analytics?.latestImport && (
                <p className="text-xs text-[#516f90] mt-2">
                  Current file: <strong>{analytics.latestImport.fileName}</strong> (
                  {analytics.latestImport.rowCount?.toLocaleString()} rows)
                </p>
              )}
            </DashboardSection>
          )}

          {step === 'analyze' && user?.isOrgAdmin && analytics?.latestImport && (
            <DashboardSection title="AI sheet review" subtitle="Perplexity reads columns and suggests reports">
              {analytics.sheetInsights?.summary && (
                <p className="text-sm text-[#33475b] mb-3 leading-relaxed">{analytics.sheetInsights.summary}</p>
              )}
              <button type="button" className="crm-btn crm-btn-primary crm-btn-sm" disabled={busy} onClick={runAnalyze}>
                {busy ? 'Analyzing…' : 'Analyze sheet with AI'}
              </button>
            </DashboardSection>
          )}

          {step === 'goals' && user?.isOrgAdmin && (
            <DashboardSection title="What do you need from this upload?" subtitle="Based on your sheet">
              <div className="space-y-2 mb-4">
                {suggestedQuestions.map((q) => (
                  <label
                    key={q.id}
                    className="flex gap-2 items-start p-2 rounded-lg border border-[#eaf0f6] bg-[#f5f8fa] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGoals.includes(q.id)}
                      onChange={(e) => {
                        setSelectedGoals((prev) =>
                          e.target.checked ? [...prev, q.id] : prev.filter((id) => id !== q.id)
                        )
                      }}
                    />
                    <span>
                      <span className="text-sm font-semibold text-[#33475b] block">{q.label || q.id}</span>
                      {q.description && (
                        <span className="text-xs text-[#7c98b6]">{q.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <label className="block mb-3">
                <span className="text-xs font-semibold text-[#516f90]">Anything else? (not in the list)</span>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full text-sm border border-[#cbd6e2] rounded-md px-3 py-2"
                  placeholder="e.g. Compare zones, flag accounts below minimum margin…"
                />
              </label>
              <button type="button" className="crm-btn crm-btn-primary" disabled={busy || !selectedGoals.length} onClick={saveGoals}>
                Build workspace report
              </button>
            </DashboardSection>
          )}

          {step === 'dashboard' && (
            <>
              {analytics?.sheetInsights?.summary && (
                <p className="text-sm text-[#516f90] mb-2">{analytics.sheetInsights.summary}</p>
              )}
              {customNotes && (
                <p className="text-xs text-[#7c98b6] mb-4 italic">Note: {customNotes}</p>
              )}
              {!analytics?.report?.blocks?.length ? (
                <DashboardEmpty>
                  {analytics?.goals?.selectedQuestionIds?.length ? (
                    <>
                      Your report choices are saved, but this sheet did not match the columns needed for those
                      charts (common with pivot-style exports). Use <strong>Change reports</strong> or upload a
                      file with customer, date, and amount per row.
                    </>
                  ) : (
                    <>Upload a file and complete setup to see reports here.</>
                  )}
                </DashboardEmpty>
              ) : (
                <div className="space-y-4">
                  {analytics.report.blocks.map((block) => (
                    <WorkspaceReportBlock key={block.id} block={block} />
                  ))}
                </div>
              )}
              {user?.isOrgAdmin && (
                <div className="flex flex-wrap gap-2 mt-6">
                  {!analytics?.report?.blocks?.length && analytics?.goals?.selectedQuestionIds?.length ? (
                    <button type="button" className="crm-btn crm-btn-primary crm-btn-sm" disabled={busy} onClick={saveGoals}>
                      Rebuild report
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary crm-btn-sm"
                    onClick={() => downloadWorkspaceTemplateXlsx()}
                  >
                    Download template
                  </button>
                  <button type="button" className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => setStep('setup')}>
                    Upload new file
                  </button>
                  <button type="button" className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => setStep('goals')}>
                    Change reports
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </DashboardShell>
  )
}

function WorkspaceReportBlock({ block }) {
  if (block.type === 'kpi') {
    return (
      <div className="dashboard-team-snapshot__kpi dashboard-team-snapshot__panel--full">
        <span className="dashboard-team-snapshot__kpi-label">{block.label}</span>
        <span className="dashboard-team-snapshot__kpi-value">
          {typeof block.value === 'number' ? formatDealValue(block.value) : block.value}
        </span>
      </div>
    )
  }

  if (block.type === 'table') {
    return (
      <DashboardSection title={block.label}>
        <div className="overflow-x-auto">
          <table className="dashboard-team-snapshot__member-table w-full">
            <thead>
              <tr>
                {block.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    )
  }

  if (block.type === 'list') {
    return (
      <DashboardSection title={block.label} subtitle={`${block.count ?? block.items?.length ?? 0} accounts`}>
        <ul className="text-sm text-[#33475b] list-disc pl-5 max-h-48 overflow-y-auto">
          {(block.items || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </DashboardSection>
    )
  }

  if (block.type === 'leader_series') {
    return (
      <DashboardSection title={block.label}>
        <div className="space-y-3">
          {(block.series || []).map((s) => (
            <div key={s.leader}>
              <p className="text-sm font-semibold text-[#33475b]">{s.leader}</p>
              <p className="text-xs text-[#7c98b6]">
                {s.periods
                  .map((p) => `${p.period}: ₹${p.value?.toLocaleString()}`)
                  .join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </DashboardSection>
    )
  }

  return null
}
