import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { DEFAULT_THEME } from '../../lib/marketingEmailDesign'
import MarketingTemplateBuilder from './MarketingTemplateBuilder'
import LoadingExperience from '../ui/LoadingExperience'

export default function MarketingLandingPanel({ forms = [], onReload }) {
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

  const save = async () => {
    if (!form.name.trim()) return setError('Name is required')
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        await api.updateMarketingLandingPage({ id: editing, ...form })
      } else {
        await api.createMarketingLandingPage(form)
      }
      setEditing(null)
      setForm({
        name: '',
        slug: '',
        title: '',
        description: '',
        formId: '',
        blocks: [],
        design: { ...DEFAULT_THEME },
        status: 'draft',
      })
      await load()
      onReload?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const publish = async (id) => {
    setBusy(true)
    try {
      await api.updateMarketingLandingPage({ id, status: 'published' })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingExperience label="Loading landing pages…" />

  const base = typeof window !== 'undefined' ? window.location.origin : 'https://connectintel.net'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="crm-section-title mb-1">Landing pages</h2>
          <p className="text-xs text-[#516f90]">Lead capture pages with block builder and optional form CTA.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="crm-content-card p-4 space-y-3">
          <input
            className="ci-input w-full"
            placeholder="Page name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value, title: p.title || e.target.value }))}
          />
          <input
            className="ci-input w-full"
            placeholder="URL slug (my-offer)"
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
          />
          <textarea
            className="ci-input w-full min-h-[4rem]"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <select
            className="ci-input w-full"
            value={form.formId}
            onChange={(e) => setForm((p) => ({ ...p, formId: e.target.value }))}
          >
            <option value="">Link capture form (optional)</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button type="button" className="ci-btn ci-btn-accent" disabled={busy} onClick={save}>
            {editing ? 'Update page' : 'Save page'}
          </button>
        </div>

        <div className="marketing-landing-builder min-h-[320px]">
          <MarketingTemplateBuilder
            compactMode
            value={{
              name: form.name,
              subject: form.title,
              body: form.description,
              blocks: form.blocks,
              design: form.design,
            }}
            onChange={(v) =>
              setForm((p) => ({
                ...p,
                title: v.subject || p.title,
                body: v.body || p.description,
                blocks: v.blocks,
                design: v.design,
              }))
            }
            busy={busy}
          />
        </div>
      </div>

      <div className="grid gap-3">
        {pages.map((p) => (
          <div key={p.id} className="crm-campaign-card">
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold text-[#33475b]">{p.name}</p>
                <p className="text-xs text-[#516f90]">
                  {p.status} · {p.views || 0} views
                </p>
                {p.status === 'published' && (
                  <a
                    className="text-xs text-[#F97316] font-medium"
                    href={`${base}/api/marketing/landing?slug=${encodeURIComponent(p.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {base}/api/marketing/landing?slug={p.slug}
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" className="crm-link-btn p-0" onClick={() => { setEditing(p.id); setForm({ ...p, design: p.design || { ...DEFAULT_THEME } }) }}>
                  Edit
                </button>
                {p.status !== 'published' && (
                  <button type="button" className="crm-link-btn p-0" disabled={busy} onClick={() => publish(p.id)}>
                    Publish
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {!pages.length && <p className="text-sm text-gray-500">No landing pages yet.</p>}
      </div>
    </div>
  )
}
