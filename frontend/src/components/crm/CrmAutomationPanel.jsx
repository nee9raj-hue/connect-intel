import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { CRM_STATUSES } from '../../lib/crmConstants'
import { pipelinesFromSettings, getPipelineStages } from '../../lib/crmPipelines'
import AutomationCanvas from '../marketing/AutomationCanvas'
import LoadingExperience from '../ui/LoadingExperience'

const CRM_TRIGGERS = [
  { id: 'status_enter', label: 'Stage entered' },
  { id: 'lead_created', label: 'Lead created' },
]

function emptyVisualWorkflow() {
  return {
    id: `vwf_${Date.now()}`,
    name: 'New workflow',
    enabled: true,
    trigger: 'status_enter',
    status: 'replied',
    graph: null,
  }
}

export default function CrmAutomationPanel() {
  const { user } = useApp()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [section, setSection] = useState('workflows')
  const [editingWorkflow, setEditingWorkflow] = useState(null)
  const [showCanvas, setShowCanvas] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getCrmSettings()
      setSettings(data.settings)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async (patch) => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.updateCrmSettings(patch)
      setSettings(data.settings)
      setNotice('Saved')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const pipelines = useMemo(() => pipelinesFromSettings(settings), [settings])
  const pipelineStages = useMemo(
    () => getPipelineStages(settings, pipelines[0]?.id) || CRM_STATUSES,
    [settings, pipelines]
  )

  if (!user?.isOrgAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Only company admins can manage CRM automation and scoring.</p>
      </div>
    )
  }

  const rules = settings?.workflowRules || []
  const visualWorkflows = settings?.visualWorkflows || []
  const scoringRules = settings?.scoringRules?.length
    ? settings.scoringRules
    : [
        { id: 'email_open', label: 'Email opened', event: 'email_open', points: 10, enabled: true },
        { id: 'link_click', label: 'Link clicked', event: 'link_click', points: 25, enabled: true },
        { id: 'meeting_booked', label: 'Meeting scheduled', event: 'meeting_booked', points: 100, enabled: true },
        { id: 'unsubscribe', label: 'Unsubscribed', event: 'unsubscribe', points: -25, enabled: true },
      ]

  const saveWorkflow = async () => {
    if (!editingWorkflow) return
    const next = visualWorkflows.some((w) => w.id === editingWorkflow.id)
      ? visualWorkflows.map((w) => (w.id === editingWorkflow.id ? editingWorkflow : w))
      : [...visualWorkflows, editingWorkflow]
    await save({ visualWorkflows: next })
    setEditingWorkflow(null)
    setShowCanvas(false)
  }

  const [pipelineDraft, setPipelineDraft] = useState(null)

  const commitPipelineNames = () => {
    if (!pipelineDraft) return
    save({ pipelines: pipelineDraft })
    setPipelineDraft(null)
  }

  const addPipeline = () => {
    if (pipelines.length >= 5) return
    const id = `pipe_${Date.now()}`
    save({
      pipelines: [
        ...pipelines,
        {
          id,
          name: 'New pipeline',
          isDefault: false,
          stages: CRM_STATUSES.map((s) => ({ id: s.id, label: s.label, color: 'slate' })),
        },
      ],
    })
  }

  const updateScoringRule = (ruleId, patch) => {
    const next = scoringRules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r))
    save({ scoringRules: next })
  }

  return (
    <div className="panel-shell">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">CRM automation</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Visual workflows, pipeline stages, and lead scoring for your workspace.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            ['workflows', 'Visual workflows'],
            ['rules', 'Quick rules'],
            ['pipelines', 'Pipelines'],
            ['scoring', 'Lead scoring'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`ci-btn !text-xs ${section === id ? 'ci-btn-accent' : 'ci-btn-secondary'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="panel-body-scroll p-5 max-w-3xl space-y-4">
        {loading ? (
          <LoadingExperience label="Loading CRM settings…" />
        ) : (
          <>
            {error && <p className="text-xs text-red-800 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {notice && <p className="text-xs text-green-900 bg-green-50 rounded-lg px-3 py-2">{notice}</p>}

            {section === 'workflows' && (
              <div className="space-y-4">
                <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(settings?.autoAssignEnabled)}
                      onChange={(e) => save({ autoAssignEnabled: e.target.checked })}
                      disabled={busy}
                    />
                    Auto-assign new leads (round robin)
                  </label>
                </section>

                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Visual workflows</h2>
                  <button
                    type="button"
                    className="ci-btn ci-btn-secondary !text-xs"
                    disabled={busy}
                    onClick={() => {
                      setEditingWorkflow(emptyVisualWorkflow())
                      setShowCanvas(true)
                    }}
                  >
                    New workflow
                  </button>
                </div>

                {!visualWorkflows.length && !editingWorkflow && (
                  <p className="text-xs text-gray-500">No visual workflows yet. Create one with the canvas builder.</p>
                )}

                <ul className="space-y-2">
                  {visualWorkflows.map((w) => (
                    <li key={w.id} className="marketing-auto-card flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{w.name}</p>
                        <p className="text-xs text-gray-500">
                          {w.trigger === 'lead_created' ? 'Lead created' : `Stage → ${w.status}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold underline"
                        onClick={() => {
                          setEditingWorkflow(w)
                          setShowCanvas(true)
                        }}
                      >
                        Edit
                      </button>
                    </li>
                  ))}
                </ul>

                {editingWorkflow && showCanvas && (
                  <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-white">
                    <input
                      className="ci-input w-full"
                      value={editingWorkflow.name}
                      onChange={(e) => setEditingWorkflow((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Workflow name"
                    />
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="ci-input"
                        value={editingWorkflow.trigger}
                        onChange={(e) => setEditingWorkflow((p) => ({ ...p, trigger: e.target.value }))}
                      >
                        {CRM_TRIGGERS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {editingWorkflow.trigger === 'status_enter' && (
                        <select
                          className="ci-input"
                          value={editingWorkflow.status}
                          onChange={(e) => setEditingWorkflow((p) => ({ ...p, status: e.target.value }))}
                        >
                          {pipelineStages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <AutomationCanvas
                      mode="crm"
                      pipelineStages={pipelineStages}
                      triggerType={editingWorkflow.trigger}
                      graph={editingWorkflow.graph}
                      onChange={(graph) => setEditingWorkflow((p) => ({ ...p, graph }))}
                    />
                    <div className="flex gap-2">
                      <button type="button" className="ci-btn ci-btn-accent" disabled={busy} onClick={saveWorkflow}>
                        Save workflow
                      </button>
                      <button
                        type="button"
                        className="ci-btn ci-btn-secondary"
                        onClick={() => {
                          setEditingWorkflow(null)
                          setShowCanvas(false)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {section === 'rules' && (
              <section className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-sm font-semibold">Quick workflow rules</h2>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save({ seedDefaults: true })}
                    className="text-xs font-medium px-2.5 py-1 border border-gray-200 rounded-lg"
                  >
                    Load defaults
                  </button>
                </div>
                {!rules.length ? (
                  <p className="text-xs text-gray-500">No rules yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {rules.map((r) => (
                      <li key={r.id} className="text-xs border border-gray-100 rounded-lg p-3">
                        <p className="font-semibold text-gray-900">{r.name}</p>
                        <p className="text-gray-500 mt-0.5">
                          When stage → <strong>{r.status}</strong>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {section === 'pipelines' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Define multiple deal pipelines per workspace. Leads use the default pipeline unless assigned otherwise.
                </p>
                {(pipelineDraft || pipelines).map((pipe) => (
                  <div key={pipe.id} className="marketing-auto-card space-y-2">
                    <input
                      className="ci-input w-full font-semibold"
                      value={pipe.name}
                      onChange={(e) => {
                        const base = pipelineDraft || pipelines
                        setPipelineDraft(
                          base.map((p) => (p.id === pipe.id ? { ...p, name: e.target.value } : p))
                        )
                      }}
                      onBlur={commitPipelineNames}
                    />
                    <p className="text-xs text-gray-500">
                      {pipe.isDefault ? 'Default pipeline' : 'Secondary pipeline'} · {(pipe.stages || []).length}{' '}
                      stages
                    </p>
                    <p className="text-xs text-gray-600">
                      {(pipe.stages || []).map((s) => s.label).join(' → ')}
                    </p>
                  </div>
                ))}
                <button type="button" className="ci-btn ci-btn-secondary !text-xs" disabled={busy} onClick={addPipeline}>
                  Add pipeline
                </button>
              </div>
            )}

            {section === 'scoring' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Points apply when conditions match. Score is capped 0–100. Changes recalculate on next lead save.
                </p>
                <table className="crm-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Rule</th>
                      <th>Points</th>
                      <th>On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoringRules.map((r) => (
                      <tr key={r.id}>
                        <td>{r.label}</td>
                        <td>
                          <input
                            type="number"
                            className="ci-input w-20"
                            value={r.points}
                            onChange={(e) => updateScoringRule(r.id, { points: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={r.enabled !== false}
                            onChange={(e) => updateScoringRule(r.id, { enabled: e.target.checked })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
