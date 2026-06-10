import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { DEFAULT_THEME } from '../../lib/marketingEmailDesign'
import MarketingTemplateBuilder from './MarketingTemplateBuilder'
import LoadingExperience from '../ui/LoadingExperience'

export default function MarketingLandingHub({ forms = [], onReload }) {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    title: '',
    description: '',
    formId: '',
    blocks: [],
    design: { ...DEFAULT_THEME },
    status: 'draft',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getMarketingLandingPages()
      setPages(res.pages || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectPage = (p) => {
    setEditing(p.id)
    setForm({ ...p, design: p.design || { ...DEFAULT_THEME }, blocks: p.blocks || [] })
  }

  const save = async (status) => {
    if (!form.name.trim()) return setError('Name is required')
    setBusy(true)
    setError(null)
    try {
      const payload = { ...form, status: status || form.status }
      if (editing) {
        await api.updateMarketingLandingPage({ id: editing, ...payload })
      } else {
        const res = await api.createMarketingLandingPage(payload)
        setEditing(res.page?.id)
      }
      await load()
      onReload?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !pages.length) return <LoadingExperience label="Loading landing pages…" />

  return (
    <div className="mhub-v3-landing-hub">
      <aside className="mhub-v3-forms-list">
        <div className="mhub-v3-card__head">
          <h3 className="mhub-v3-card__title">Landing pages</h3>
          <button
            type="button"
            className="mhub-v3-btn mhub-v3-btn--primary"
            style={{ fontSize: 11 }}
            onClick={() => {
              setEditing(null)
              setForm({ name: '', slug: '', title: '', description: '', formId: '', blocks: [], design: { ...DEFAULT_THEME }, status: 'draft' })
            }}
          >
            + New page
          </button>
        </div>
        {pages.map((p) => (
          <button key={p.id} type="button" className={`mhub-v3-form-card${editing === p.id ? ' is-active' : ''}`} onClick={() => selectPage(p)}>
            <strong>{p.name}</strong>
            <span>/p/{p.slug}</span>
            <span>{p.visits || 0} visits · {p.conversions || 0} conversions</span>
          </button>
        ))}
      </aside>

      <div className="mhub-v3-landing-builder">
        <header className="mhub-v3-forms-builder__head">
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{form.name || 'New landing page'}</h3>
            {form.slug ? <p style={{ fontSize: 11, color: '#999', margin: '2px 0 0' }}>connectintel.net/p/{form.slug}</p> : null}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="mhub-v3-btn" disabled={busy} onClick={() => save('draft')}>
              Save draft
            </button>
            <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={() => save('published')}>
              Publish
            </button>
          </div>
        </header>
        <div className="mhub-v3-form-stack" style={{ padding: 12 }}>
          <input className="mhub-v3-input" placeholder="Page name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="mhub-v3-input" placeholder="URL slug" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />
          <select className="mhub-v3-input" value={form.formId} onChange={(e) => setForm((p) => ({ ...p, formId: e.target.value }))}>
            <option value="">Embedded form (optional)</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="marketing-immersive-editor flex-1 min-h-0" style={{ minHeight: 400 }}>
          <MarketingTemplateBuilder
            compactMode
            studioMode
            value={{ name: form.name, subject: form.title, body: '', blocks: form.blocks, design: form.design }}
            onChange={(v) => setForm((p) => ({ ...p, blocks: v.blocks, design: v.design, title: v.subject || p.title }))}
            onSave={() => save(form.status)}
            busy={busy}
          />
        </div>
        {error ? <p style={{ color: '#dc2626', fontSize: 12, padding: 8 }}>{error}</p> : null}
      </div>
    </div>
  )
}
