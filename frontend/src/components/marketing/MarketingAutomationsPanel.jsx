import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import LoadingExperience from '../ui/LoadingExperience'
import AutomationCanvas from './AutomationCanvas'

const TRIGGERS = [
  { id: 'contact_added', label: 'Contact added to pipeline' },
  { id: 'form_submitted', label: 'Form submitted' },
  { id: 'lead_created', label: 'Lead created' },
  { id: 'email_opened', label: 'Email opened' },
  { id: 'link_clicked', label: 'Link clicked' },
]

export default function MarketingAutomationsPanel({
  campaigns = [],
  segments = [],
  lists = [],
  permissions,
  onReload,
}) {
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    name: '',
    triggerType: 'contact_added',
    campaignId: '',
    segmentId: '',
    listId: '',
    delayDays: 0,
    graph: null,
  })
  const [showCanvas, setShowCanvas] = useState(false)

  const canManage = permissions?.canManageAutomations || permissions?.canCreate

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getMarketingAutomations()
      setAutomations(res.automations || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    if (!form.name.trim()) return setError('Name is required')
    if (!form.campaignId) return setError('Choose a campaign to send')
    setBusy(true)
    setError(null)
    try {
      const graph = form.graph || {
        nodes: [
          { id: 'start', type: 'trigger', label: form.triggerType, x: 80, y: 120, config: { type: form.triggerType } },
          { id: 'delay', type: 'delay', label: `${form.delayDays}d`, x: 280, y: 120, config: { delayDays: Number(form.delayDays) || 0 } },
          { id: 'send', type: 'action', label: 'Send email', x: 480, y: 120, config: { action: 'send_email', campaignId: form.campaignId } },
        ],
        edges: [
          { from: 'start', to: 'delay' },
          { from: 'delay', to: 'send' },
        ],
      }
      await api.createMarketingAutomation({
        name: form.name.trim(),
        status: 'draft',
        trigger: { type: form.triggerType, config: {} },
        campaignId: form.campaignId,
        segmentId: form.segmentId || undefined,
        listId: form.listId || undefined,
        delayDays: Number(form.delayDays) || 0,
        graph,
      })
      setForm({
        name: '',
        triggerType: 'contact_added',
        campaignId: '',
        segmentId: '',
        listId: '',
        delayDays: 0,
      })
      await load()
      onReload?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (row) => {
    setBusy(true)
    try {
      await api.updateMarketingAutomation({
        id: row.id,
        status: row.status === 'active' ? 'paused' : 'active',
      })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingExperience label="Loading automations…" />

  return (
    <div className="space-y-5">
      <div>
        <h2 className="crm-section-title mb-1">Marketing automations</h2>
        <p className="text-xs text-[#516f90]">
          Trigger → delay → send email. Visual journey builder expands in a future release.
        </p>
      </div>

      {canManage && (
        <div className="crm-content-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#33475b]">New automation</h3>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Automation name"
            className="ci-input w-full"
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <select
              value={form.triggerType}
              onChange={(e) => setForm((p) => ({ ...p, triggerType: e.target.value }))}
              className="ci-input w-full"
            >
              {TRIGGERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              max={30}
              value={form.delayDays}
              onChange={(e) => setForm((p) => ({ ...p, delayDays: e.target.value }))}
              className="ci-input w-full"
              placeholder="Delay (days)"
            />
          </div>
          <select
            value={form.campaignId}
            onChange={(e) => setForm((p) => ({ ...p, campaignId: e.target.value }))}
            className="ci-input w-full"
          >
            <option value="">Campaign to send…</option>
            {campaigns
              .filter((c) => c.status === 'draft' || c.status === 'completed')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select
            value={form.segmentId}
            onChange={(e) => setForm((p) => ({ ...p, segmentId: e.target.value }))}
            className="ci-input w-full"
          >
            <option value="">Audience segment (optional)</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.memberCount ?? 0})
              </option>
            ))}
          </select>
          <button type="button" className="ci-btn ci-btn-secondary !text-xs" onClick={() => setShowCanvas((v) => !v)}>
            {showCanvas ? 'Hide canvas' : 'Visual builder'}
          </button>
          <button type="button" className="ci-btn ci-btn-accent" disabled={busy} onClick={handleCreate}>
            Create automation
          </button>
          {showCanvas && (
            <AutomationCanvas
              graph={form.graph}
              campaigns={campaigns}
              triggerType={form.triggerType}
              campaignId={form.campaignId}
              delayDays={form.delayDays}
              onChange={(graph) => setForm((p) => ({ ...p, graph }))}
            />
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-3">
        {automations.map((a) => (
          <div key={a.id} className="marketing-auto-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#33475b]">{a.name}</p>
                <p className="text-xs text-[#516f90]">
                  Trigger: {a.trigger?.type || '—'} · Delay {a.delayDays || 0}d · Status: {a.status}
                </p>
                <div className="marketing-auto-flow mt-2">
                  {(a.graph?.nodes || []).map((n) => (
                    <span key={n.id} className="marketing-auto-node">
                      {n.label || n.type}
                    </span>
                  ))}
                </div>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="ci-btn ci-btn-secondary !text-xs"
                  disabled={busy}
                  onClick={() => toggleActive(a)}
                >
                  {a.status === 'active' ? 'Pause' : 'Activate'}
                </button>
              )}
            </div>
          </div>
        ))}
        {!automations.length && (
          <p className="text-sm text-gray-500">No automations yet. Create a trigger-based journey above.</p>
        )}
      </div>
    </div>
  )
}
