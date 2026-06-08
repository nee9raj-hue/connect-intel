import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import LoadingExperience from '../ui/LoadingExperience'

export default function MarketingFeedsPanel({ lists = [], segments = [], templates = [], onReload }) {
  const [feeds, setFeeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    name: '',
    feedUrl: '',
    listId: '',
    segmentId: '',
    templateId: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getMarketingFeeds()
      setFeeds(res.feeds || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    if (!form.name.trim() || !form.feedUrl.trim()) {
      return setError('Name and feed URL are required')
    }
    setBusy(true)
    setError(null)
    try {
      await api.createMarketingFeed({
        name: form.name.trim(),
        feedUrl: form.feedUrl.trim(),
        listId: form.listId || undefined,
        segmentId: form.segmentId || undefined,
        templateId: form.templateId || undefined,
      })
      setForm({ name: '', feedUrl: '', listId: '', segmentId: '', templateId: '' })
      await load()
      onReload?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    setBusy(true)
    try {
      await api.deleteMarketingFeed(id)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !feeds.length) {
    return <LoadingExperience label="Loading RSS feeds…" />
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="crm-section-title mb-1">RSS / recurring feeds</h2>
        <p className="text-xs text-[#516f90]">
          Connect a blog or news feed. New items spawn scheduled email campaigns automatically (checked every cron run).
        </p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="crm-form-grid">
        <input
          className="ci-input"
          placeholder="Feed name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
        <input
          className="ci-input"
          placeholder="https://example.com/feed.xml"
          value={form.feedUrl}
          onChange={(e) => setForm((p) => ({ ...p, feedUrl: e.target.value }))}
        />
        <select
          className="ci-input"
          value={form.listId}
          onChange={(e) => setForm((p) => ({ ...p, listId: e.target.value, segmentId: '' }))}
        >
          <option value="">Audience: all pipeline (no list)</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              List: {l.name}
            </option>
          ))}
        </select>
        <select
          className="ci-input"
          value={form.segmentId}
          onChange={(e) => setForm((p) => ({ ...p, segmentId: e.target.value, listId: '' }))}
        >
          <option value="">Or segment…</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              Segment: {s.name}
            </option>
          ))}
        </select>
        <select
          className="ci-input"
          value={form.templateId}
          onChange={(e) => setForm((p) => ({ ...p, templateId: e.target.value }))}
        >
          <option value="">Default template (optional)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="button" className="ci-btn ci-btn-accent" disabled={busy} onClick={create}>
          Add feed
        </button>
      </div>

      {!feeds.length ? (
        <p className="text-sm text-[#516f90]">No feeds yet.</p>
      ) : (
        <ul className="space-y-2">
          {feeds.map((f) => (
            <li key={f.id} className="marketing-auto-card flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-sm text-[#33475b]">{f.name}</p>
                <p className="text-xs text-gray-500 break-all">{f.feedUrl}</p>
                {f.lastItemTitle && (
                  <p className="text-xs text-gray-600 mt-1">Last item: {f.lastItemTitle}</p>
                )}
              </div>
              <button
                type="button"
                className="text-xs text-red-700 font-semibold"
                disabled={busy}
                onClick={() => remove(f.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
