import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { CRM_STATUSES } from '../../lib/crmConstants'
import { DEFAULT_FORM_FIELDS, DEFAULT_FORM_THEME } from '../../../../lib/marketingFormSchema.js'
import MarketingFormPalette, { MarketingFormFieldInspector } from './MarketingFormBuilder'
import MarketingFormPreview from './MarketingFormPreview'

const EMPTY_FORM = {
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

function formFromRow(f) {
  return {
    ...EMPTY_FORM,
    ...f,
    fields: f.fields?.length ? f.fields : DEFAULT_FORM_FIELDS,
    theme: f.theme || { ...DEFAULT_FORM_THEME },
  }
}

function publicUrl(form) {
  if (form.publicUrl) return form.publicUrl
  const base = window.location.origin
  return `${base}/api/marketing/form?slug=${encodeURIComponent(form.slug || '')}`
}

export default function MarketingFormsHub({ teamMembers = [], onReload }) {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [phase, setPhase] = useState('list')
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [selectedFieldId, setSelectedFieldId] = useState(null)
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

  const openNew = () => {
    setForm({ ...EMPTY_FORM, fields: [...DEFAULT_FORM_FIELDS] })
    setSelectedFieldId(null)
    setPhase('studio')
    setError(null)
    setNotice(null)
  }

  const openForm = (f) => {
    setForm(formFromRow(f))
    setSelectedFieldId(null)
    setPhase('studio')
    setError(null)
    setNotice(null)
  }

  const save = async (status) => {
    if (!form.name.trim()) return setError('Internal form name is required')
    if (!form.title.trim()) return setError('Public title is required')
    const hasEmail = (form.fields || []).some((f) => f.type === 'email' || f.id === 'email')
    if (!hasEmail) return setError('Add an email field so submissions can match pipeline contacts')
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload = { ...form, status: status || form.status || 'draft' }
      if (form.id) {
        await api.updateMarketingForm(payload)
      } else {
        const res = await api.createMarketingForm(payload)
        const created = res.form
        setForm((p) => ({
          ...p,
          id: created?.id,
          slug: created?.slug,
          publicUrl: created?.publicUrl,
        }))
        if (status === 'live') {
          setPublishModal(created)
          setNotice('Form published')
          await load()
          onReload?.()
          return
        }
      }
      await load()
      onReload?.()
      if (status === 'live') {
        const list = (await api.listMarketingForms()).forms || []
        const updated = list.find((x) => x.id === form.id) || form
        setPublishModal(updated)
        setNotice('Form published')
      } else {
        setNotice('Draft saved')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const removeForm = async (id) => {
    if (!window.confirm('Delete this form? The public link will stop working.')) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteMarketingForm(id)
      if (form.id === id) {
        setPhase('list')
        setForm({ ...EMPTY_FORM })
      }
      await load()
      onReload?.()
      setNotice('Form deleted')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Link copied')
    } catch {
      setNotice(url)
    }
  }

  if (phase === 'list') {
    return (
      <div className="mhub-form-studio mhub-form-studio--list">
        <header className="mhub-form-studio__list-head">
          <div>
            <h2 className="mhub-form-studio__title">Signup forms</h2>
            <p className="mhub-form-studio__subtitle">
              Capture leads on your site. Submissions flow into Pipeline with consent and a timeline event — not
              marketing broadcasts.
            </p>
          </div>
          <button type="button" className="mc-btn mc-btn--primary" onClick={openNew}>
            Create form
          </button>
        </header>

        {notice ? <p className="mhub-form-studio__notice">{notice}</p> : null}
        {error ? <p className="mhub-form-studio__error">{error}</p> : null}

        {loading ? (
          <p className="mhub-v3-empty">Loading forms…</p>
        ) : !forms.length ? (
          <div className="mhub-form-studio__empty">
            <div className="mhub-form-studio__empty-art" aria-hidden />
            <h3>Turn visitors into pipeline leads</h3>
            <p>
              Build a branded form with email consent, embed it on your site, and every submission creates or updates a
              contact in CRM.
            </p>
            <button type="button" className="mc-btn mc-btn--primary" onClick={openNew}>
              Build your first form
            </button>
          </div>
        ) : (
          <div className="mhub-form-studio__grid">
            {forms.map((f) => (
              <article key={f.id} className="mhub-form-studio__card">
                <div className="mhub-form-studio__card-head">
                  <h3>{f.name}</h3>
                  <span className={`mhub-form-studio__status mhub-form-studio__status--${f.status || 'draft'}`}>
                    {f.status === 'live' ? 'Live' : 'Draft'}
                  </span>
                </div>
                <p className="mhub-form-studio__card-meta">
                  {(f.submissions || 0).toLocaleString()} submissions · /f/{f.slug}
                </p>
                <div className="mhub-form-studio__card-actions">
                  <button type="button" className="mc-btn mc-btn--outline mc-btn--sm" onClick={() => openForm(f)}>
                    Edit
                  </button>
                  {f.status === 'live' ? (
                    <button
                      type="button"
                      className="mc-btn mc-btn--ghost mc-btn--sm"
                      onClick={() => copyLink(publicUrl(f))}
                    >
                      Copy link
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="mc-btn mc-btn--ghost mc-btn--sm mhub-form-studio__delete"
                    onClick={() => removeForm(f.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mhub-form-studio mhub-form-studio--editor">
      <header className="mhub-form-studio__toolbar">
        <button type="button" className="mc-btn mc-btn--ghost mc-btn--sm" onClick={() => setPhase('list')}>
          ← Forms
        </button>
        <div className="mhub-form-studio__toolbar-meta">
          <input
            className="mhub-form-studio__name-input"
            placeholder="Internal name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          {form.status === 'live' ? <span className="mhub-form-studio__status mhub-form-studio__status--live">Live</span> : null}
        </div>
        <div className="mhub-form-studio__toolbar-actions">
          {form.id && form.slug ? (
            <button type="button" className="mc-btn mc-btn--ghost mc-btn--sm" onClick={() => copyLink(publicUrl(form))}>
              Copy link
            </button>
          ) : null}
          <button type="button" className="mc-btn mc-btn--outline mc-btn--sm" disabled={busy} onClick={() => save('draft')}>
            Save draft
          </button>
          <button type="button" className="mc-btn mc-btn--primary mc-btn--sm" disabled={busy} onClick={() => save('live')}>
            Publish
          </button>
        </div>
      </header>

      {error ? <p className="mhub-form-studio__error mhub-form-studio__error--bar">{error}</p> : null}
      {notice ? <p className="mhub-form-studio__notice mhub-form-studio__notice--bar">{notice}</p> : null}

      <div className="mhub-form-studio__workspace">
        <MarketingFormPalette form={form} onChange={setForm} onSelectFieldId={setSelectedFieldId} />

        <div className="mhub-form-studio__preview-wrap">
          <p className="mhub-v3-eyebrow mhub-form-studio__preview-label">Live preview — click a field to edit</p>
          <MarketingFormPreview form={form} selectedFieldId={selectedFieldId} onSelectField={setSelectedFieldId} />
        </div>

        <aside className="mhub-form-studio__settings">
          <p className="mhub-v3-eyebrow">Field settings</p>
          <MarketingFormFieldInspector
            form={form}
            onChange={setForm}
            selectedFieldId={selectedFieldId}
            onSelectFieldId={setSelectedFieldId}
          />

          <p className="mhub-v3-eyebrow mhub-form-studio__section-gap">Form content</p>
          <label className="mhub-v3-label">
            Public title
            <input
              className="mhub-v3-input"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Shown at the top of the form"
            />
          </label>
          <label className="mhub-v3-label">
            Description
            <textarea
              className="mhub-v3-input"
              rows={2}
              value={form.description || ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional intro for visitors"
            />
          </label>
          <label className="mhub-v3-label">
            Submit button
            <input
              className="mhub-v3-input"
              value={form.submitLabel || ''}
              onChange={(e) => setForm((p) => ({ ...p, submitLabel: e.target.value }))}
            />
          </label>

          <p className="mhub-v3-eyebrow mhub-form-studio__section-gap">Branding</p>
          <div className="mhub-form-studio__colors">
            <label className="mhub-v3-label">
              Accent
              <input
                type="color"
                className="mhub-form-studio__color"
                value={form.theme?.primaryColor || DEFAULT_FORM_THEME.primaryColor}
                onChange={(e) => setForm((p) => ({ ...p, theme: { ...p.theme, primaryColor: e.target.value } }))}
              />
            </label>
            <label className="mhub-v3-label">
              Page
              <input
                type="color"
                className="mhub-form-studio__color"
                value={form.theme?.pageBackground || DEFAULT_FORM_THEME.pageBackground}
                onChange={(e) => setForm((p) => ({ ...p, theme: { ...p.theme, pageBackground: e.target.value } }))}
              />
            </label>
            <label className="mhub-v3-label">
              Card
              <input
                type="color"
                className="mhub-form-studio__color"
                value={form.theme?.cardBackground || DEFAULT_FORM_THEME.cardBackground}
                onChange={(e) => setForm((p) => ({ ...p, theme: { ...p.theme, cardBackground: e.target.value } }))}
              />
            </label>
          </div>

          <p className="mhub-v3-eyebrow mhub-form-studio__section-gap">Pipeline</p>
          <label className="mhub-v3-label">
            New lead stage
            <select
              className="mhub-v3-input"
              value={form.pipelineStage || 'new'}
              onChange={(e) => setForm((p) => ({ ...p, pipelineStage: e.target.value }))}
            >
              {CRM_STATUSES.filter((s) => !['won', 'lost', 'active_trading'].includes(s.id)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mhub-v3-label">
            Assignment
            <select
              className="mhub-v3-input"
              value={form.assignMode || 'round_robin'}
              onChange={(e) => setForm((p) => ({ ...p, assignMode: e.target.value }))}
            >
              <option value="round_robin">Round-robin</option>
              <option value="unassigned">Unassigned pool</option>
              {teamMembers?.length ? <option value="specific">Specific rep (coming soon)</option> : null}
            </select>
          </label>

          <p className="mhub-v3-eyebrow mhub-form-studio__section-gap">After submit</p>
          <label className="mhub-v3-label">
            Thank-you message
            <textarea
              className="mhub-v3-input"
              rows={3}
              value={form.thankYouMessage || ''}
              onChange={(e) => setForm((p) => ({ ...p, thankYouMessage: e.target.value }))}
            />
          </label>
          <label className="mhub-v3-label">
            Redirect URL (optional)
            <input
              className="mhub-v3-input"
              placeholder="https://yoursite.com/thanks"
              value={form.redirectUrl || ''}
              onChange={(e) => setForm((p) => ({ ...p, redirectUrl: e.target.value }))}
            />
          </label>
        </aside>
      </div>

      {publishModal ? (
        <div className="mhub-v3-detail-overlay" onClick={() => setPublishModal(null)}>
          <div className="mhub-v3-card mhub-form-studio__publish" onClick={(e) => e.stopPropagation()}>
            <h3 className="mhub-v3-card__title">Form is live</h3>
            <p className="mhub-form-studio__publish-url">{publicUrl(publishModal)}</p>
            <div className="mhub-form-studio__publish-actions">
              <button type="button" className="mc-btn mc-btn--primary" onClick={() => copyLink(publicUrl(publishModal))}>
                Copy link
              </button>
              <button type="button" className="mc-btn mc-btn--outline" onClick={() => setPublishModal(null)}>
                Done
              </button>
            </div>
            <pre className="mhub-v3-dns-block mhub-form-studio__embed">{`<iframe src="${publicUrl(publishModal)}" width="100%" height="520" style="border:0;" title="Connect Intel form"></iframe>`}</pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}
