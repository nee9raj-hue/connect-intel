import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import AutomationCanvas from './AutomationCanvas'
import LoadingExperience from '../ui/LoadingExperience'

const TRIGGERS = [
  { id: 'contact_added', label: 'Contact added to pipeline' },
  { id: 'lead_stage_changed', label: 'Lead stage changed' },
  { id: 'form_submitted', label: 'Form submitted' },
  { id: 'tag_added', label: 'Tag added' },
  { id: 'deal_created', label: 'Deal created' },
  { id: 'sequence_completed', label: 'CRM sequence completed' },
]

const STEP_TYPES = [
  { id: 'wait', label: 'Wait' },
  { id: 'send_email', label: 'Send email' },
  { id: 'add_tag', label: 'Add tag' },
  { id: 'update_stage', label: 'Update lead stage' },
  { id: 'notify_rep', label: 'Notify rep' },
  { id: 'end', label: 'End' },
]

function FlowPreview({ graph, triggerLabel }) {
  const nodes = graph?.nodes || []
  return (
    <div className="mhub-v3-flow-canvas">
      <div className="mhub-v3-flow-node mhub-v3-flow-node--trigger">
        <span className="mhub-v3-eyebrow">Trigger</span>
        <strong>{triggerLabel}</strong>
      </div>
      <div className="mhub-v3-flow-line" />
      {nodes
        .filter((n) => n.type !== 'trigger')
        .map((n) => (
          <div key={n.id}>
            <div className={`mhub-v3-flow-node mhub-v3-flow-node--${n.type}`}>
              <span className="mhub-v3-eyebrow">{n.type}</span>
              <strong>{n.label}</strong>
            </div>
            <div className="mhub-v3-flow-line" />
          </div>
        ))}
      <button type="button" className="mhub-v3-flow-add" disabled>
        + Add step
      </button>
    </div>
  )
}

export default function MarketingAutomationsHub({ campaigns = [], permissions, onReload }) {
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    triggerType: 'contact_added',
    campaignId: '',
    delayDays: 0,
    graph: null,
  })

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

  const filtered = automations.filter((a) => filter === 'all' || a.status === filter)

  const startCreate = () => {
    setEditing('new')
    setForm({ name: 'New automation', triggerType: 'contact_added', campaignId: '', delayDays: 0, graph: null })
  }

  const save = async (publish) => {
    if (!form.name.trim()) return setError('Name is required')
    setBusy(true)
    setError(null)
    const graph = form.graph || {
      nodes: [
        { id: 'start', type: 'trigger', label: TRIGGERS.find((t) => t.id === form.triggerType)?.label, config: { type: form.triggerType } },
        { id: 'delay', type: 'delay', label: `${form.delayDays} days`, config: { delayDays: Number(form.delayDays) || 0 } },
        { id: 'send', type: 'action', label: 'Send email', config: { action: 'send_email', campaignId: form.campaignId } },
      ],
      edges: [
        { from: 'start', to: 'delay' },
        { from: 'delay', to: 'send' },
      ],
    }
    try {
      if (editing && editing !== 'new') {
        await api.updateMarketingAutomation({ id: editing, ...form, graph, status: publish ? 'active' : 'draft' })
      } else {
        await api.createMarketingAutomation({
          name: form.name.trim(),
          status: publish ? 'active' : 'draft',
          trigger: { type: form.triggerType },
          campaignId: form.campaignId,
          delayDays: Number(form.delayDays) || 0,
          graph,
        })
      }
      setEditing(null)
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
      await api.updateMarketingAutomation({ id: row.id, status: row.status === 'active' ? 'paused' : 'active' })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingExperience label="Loading automations…" />

  return (
    <div className="mhub-v3-automations-hub">
      <aside className="mhub-v3-automations-list">
        <div className="mhub-v3-card__head">
          <h3 className="mhub-v3-card__title">Automations</h3>
          {canManage ? (
            <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" style={{ fontSize: 11 }} onClick={startCreate}>
              + Create
            </button>
          ) : null}
        </div>
        <div className="mhub-v3-periods" style={{ marginBottom: 10 }}>
          {['all', 'active', 'paused', 'draft'].map((f) => (
            <button key={f} type="button" className={`mhub-v3-period${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        {!filtered.length ? <p className="mhub-v3-empty">No automations yet.</p> : null}
        {filtered.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`mhub-v3-form-card${editing === a.id ? ' is-active' : ''}`}
            onClick={() => {
              setEditing(a.id)
              setForm({
                name: a.name,
                triggerType: a.trigger?.type || 'contact_added',
                campaignId: a.campaignId || '',
                delayDays: a.delayDays || 0,
                graph: a.graph,
              })
            }}
          >
            <strong>⚡ {a.name}</strong>
            <span>{a.status}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" className="mhub-v3-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); toggleActive(a) }}>
                {a.status === 'active' ? 'Pause' : 'Activate'}
              </button>
            </div>
          </button>
        ))}
      </aside>

      <div className="mhub-v3-automations-builder">
        {editing ? (
          <>
            <header className="mhub-v3-forms-builder__head">
              <input
                className="mhub-v3-input"
                style={{ maxWidth: 320 }}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="mhub-v3-btn" disabled={busy} onClick={() => save(false)}>
                  Save
                </button>
                <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={() => save(true)}>
                  Publish
                </button>
              </div>
            </header>
            <div className="mhub-v3-automations-split">
              <div>
                <label className="mhub-v3-label">
                  Trigger
                  <select className="mhub-v3-input" value={form.triggerType} onChange={(e) => setForm((p) => ({ ...p, triggerType: e.target.value }))}>
                    {TRIGGERS.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className="mhub-v3-label">
                  Wait (days)
                  <input type="number" className="mhub-v3-input" min={0} value={form.delayDays} onChange={(e) => setForm((p) => ({ ...p, delayDays: e.target.value }))} />
                </label>
                <label className="mhub-v3-label">
                  Send campaign
                  <select className="mhub-v3-input" value={form.campaignId} onChange={(e) => setForm((p) => ({ ...p, campaignId: e.target.value }))}>
                    <option value="">Select…</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <FlowPreview graph={form.graph} triggerLabel={TRIGGERS.find((t) => t.id === form.triggerType)?.label} />
              </div>
              <div className="mhub-v3-card" style={{ minHeight: 280 }}>
                <p className="mhub-v3-eyebrow">Visual builder</p>
                <AutomationCanvas
                  graph={form.graph}
                  campaigns={campaigns}
                  triggerType={form.triggerType}
                  campaignId={form.campaignId}
                  delayDays={form.delayDays}
                  onChange={(graph) => setForm((p) => ({ ...p, graph }))}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="mhub-v3-empty" style={{ padding: 40 }}>
            Select an automation or create one to open the visual builder.
          </p>
        )}
        {error ? <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p> : null}
      </div>
    </div>
  )
}
