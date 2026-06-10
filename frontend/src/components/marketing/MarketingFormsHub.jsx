import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { DEFAULT_FORM_FIELDS, DEFAULT_FORM_THEME } from '../../../../lib/marketingFormSchema.js'
import MarketingFormBuilder from './MarketingFormBuilder'
import { MH } from './marketingTheme'

const EMPTY = {
  name: '',
  title: '',
  description: '',
  submitLabel: 'Submit',
  fields: DEFAULT_FORM_FIELDS,
  theme: { ...DEFAULT_FORM_THEME },
  pipelineStage: 'new',
  assignMode: 'round_robin',
  thankYouMessage: 'Thank you! We will be in touch.',
  redirectUrl: '',
  status: 'draft',
}

const PALETTE = [
  { type: 'text', label: 'First name' },
  { type: 'text', label: 'Last name' },
  { type: 'email', label: 'Email' },
  { type: 'tel', label: 'Phone' },
  { type: 'text', label: 'Company' },
  { type: 'textarea', label: 'Message' },
  { type: 'url', label: 'Website' },
]

export default function MarketingFormsHub({ teamMembers = [], onReload }) {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [publishModal, setPublishModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listMarketingForms()
      setForms(res.forms || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectForm = (f) => {
    setForm({
      ...EMPTY,
      ...f,
      fields: f.fields || DEFAULT_FORM_FIELDS,
      theme: f.theme || { ...DEFAULT_FORM_THEME },
    })
  }

  const save = async (status) => {
    if (!form.name.trim()) return setError('Form name is required')
    setBusy(true)
    setError(null)
    try {
      const payload = { ...form, status: status || form.status || 'draft' }
      if (form.id) {
        await api.updateMarketingForm(payload)
      } else {
        const res = await api.createMarketingForm(payload)
        setForm((p) => ({ ...p, id: res.form?.id, slug: res.form?.slug, publicUrl: res.form?.publicUrl }))
      }
      await load()
      onReload?.()
      if (status === 'live') {
        const updated = (await api.listMarketingForms()).forms?.find((x) => x.id === form.id)
        setPublishModal(updated || form)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const copyLink = (url) => {
    void navigator.clipboard.writeText(url)
  }

  return (
    <div className="mhub-v3-forms-hub">
      <aside className="mhub-v3-forms-list">
        <div className="mhub-v3-card__head">
          <h3 className="mhub-v3-card__title">Forms</h3>
          <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => setForm({ ...EMPTY })}>
            + Create
          </button>
        </div>
        {loading ? <p className="mhub-v3-empty">Loading…</p> : null}
        {forms.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`mhub-v3-form-card${form.id === f.id ? ' is-active' : ''}`}
            onClick={() => selectForm(f)}
          >
            <strong>{f.name}</strong>
            <span>
              {f.submissions || 0} submissions · slug {f.slug}
            </span>
            <span className={`mhub-v3-badge${f.status === 'live' ? '' : ''}`} style={{ background: f.status === 'live' ? '#eaf3de' : '#f0f0ee', color: f.status === 'live' ? '#27500a' : '#666' }}>
              {f.status === 'live' ? 'Live' : f.status || 'Draft'}
            </span>
          </button>
        ))}
      </aside>

      <div className="mhub-v3-forms-builder">
        <header className="mhub-v3-forms-builder__head">
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{form.id ? form.name : 'New form'}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="mhub-v3-btn" disabled={busy} onClick={() => save('draft')}>
              Save draft
            </button>
            <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={() => save('live')}>
              Publish
            </button>
          </div>
        </header>

        <div className="mhub-v3-forms-builder__grid">
          <aside className="mhub-v3-forms-palette">
            <p className="mhub-v3-eyebrow">Standard</p>
            {PALETTE.map((p) => (
              <button
                key={p.label}
                type="button"
                className="mhub-v3-palette-item"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    fields: [
                      ...prev.fields,
                      {
                        id: `f_${Math.random().toString(36).slice(2, 8)}`,
                        type: p.type,
                        label: p.label,
                        required: p.label === 'Email',
                        placeholder: '',
                      },
                    ],
                  }))
                }
              >
                {p.label}
              </button>
            ))}
          </aside>

          <div className="mhub-v3-forms-canvas">
            <input
              className="mhub-v3-input"
              placeholder="Internal name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="mhub-v3-input"
              placeholder="Public title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
            <MarketingFormBuilder value={form} onChange={setForm} />
          </div>

          <aside className="mhub-v3-forms-settings">
            <p className="mhub-v3-eyebrow">Pipeline</p>
            <label className="mhub-v3-label">
              Create lead on submission
              <select
                className="mhub-v3-input"
                value={form.pipelineStage || 'new'}
                onChange={(e) => setForm((p) => ({ ...p, pipelineStage: e.target.value }))}
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
              </select>
            </label>
            <label className="mhub-v3-label">
              Assign
              <select
                className="mhub-v3-input"
                value={form.assignMode || 'round_robin'}
                onChange={(e) => setForm((p) => ({ ...p, assignMode: e.target.value }))}
              >
                <option value="round_robin">Auto round-robin</option>
                <option value="specific">Specific rep</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
            <p className="mhub-v3-eyebrow" style={{ marginTop: 16 }}>
              After submit
            </p>
            <textarea
              className="mhub-v3-input"
              rows={3}
              placeholder="Thank you message"
              value={form.thankYouMessage || ''}
              onChange={(e) => setForm((p) => ({ ...p, thankYouMessage: e.target.value }))}
            />
            <input
              className="mhub-v3-input"
              placeholder="Or redirect URL"
              value={form.redirectUrl || ''}
              onChange={(e) => setForm((p) => ({ ...p, redirectUrl: e.target.value }))}
            />
          </aside>
        </div>
        {error ? <p style={{ color: MH.danger, fontSize: 12, padding: 8 }}>{error}</p> : null}
      </div>

      {publishModal ? (
        <div className="mhub-v3-detail-overlay" onClick={() => setPublishModal(null)}>
          <div className="mhub-v3-card" style={{ maxWidth: 480, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="mhub-v3-card__title">Your form is live!</h3>
            <p style={{ fontSize: 12, marginBottom: 8 }}>
              Share link: {publishModal.publicUrl || `https://connectintel.net/f/${publishModal.slug}`}
            </p>
            <button type="button" className="mhub-v3-btn" onClick={() => copyLink(publishModal.publicUrl || `https://connectintel.net/f/${publishModal.slug}`)}>
              Copy link
            </button>
            <pre className="mhub-v3-dns-block" style={{ marginTop: 12, fontSize: 10 }}>
              {`<iframe src="${publishModal.publicUrl || `https://connectintel.net/f/${publishModal.slug}`}" width="100%" height="500"></iframe>`}
            </pre>
            <button type="button" className="mhub-v3-link" style={{ marginTop: 8 }} onClick={() => setPublishModal(null)}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
