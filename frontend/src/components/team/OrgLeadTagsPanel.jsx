import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'

const PRESET_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#d97706',
  '#059669',
  '#4f46e5',
  '#0d9488',
  '#dc2626',
]

export default function OrgLeadTagsPanel({ onTagsChange }) {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getOrgLeadTags()
      const next = data.tags || []
      setTags(next)
      onTagsChange?.(next)
    } catch (e) {
      setError(e.message || 'Could not load tags')
    } finally {
      setLoading(false)
    }
  }, [onTagsChange])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const data = await api.createOrgLeadTag({ name: trimmed, color: color || PRESET_COLORS[0] })
      const next = data.tags || []
      setTags(next)
      onTagsChange?.(next)
      setName('')
      setNotice(`Tag “${data.tag?.name || trimmed}” created`)
    } catch (e) {
      setError(e.message || 'Could not create tag')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (tag) => {
    setEditingId(tag.id)
    setEditName(tag.name)
  }

  const saveEdit = async (tagId) => {
    const trimmed = editName.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const data = await api.updateOrgLeadTag({ id: tagId, name: trimmed })
      const next = data.tags || []
      setTags(next)
      onTagsChange?.(next)
      setEditingId(null)
      setNotice('Tag updated')
    } catch (e) {
      setError(e.message || 'Could not update tag')
    } finally {
      setBusy(false)
    }
  }

  const removeTag = async (tag) => {
    if (!window.confirm(`Delete tag “${tag.name}”? It will be removed from all leads.`)) return
    setBusy(true)
    setError(null)
    try {
      const data = await api.deleteOrgLeadTag(tag.id)
      const next = data.tags || []
      setTags(next)
      onTagsChange?.(next)
      setNotice(`Tag “${tag.name}” deleted`)
    } catch (e) {
      setError(e.message || 'Could not delete tag')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Lead tags</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Create labels for your team (e.g. B2B, B2C, UK, Air). Anyone on the team can tag leads; only admins
          manage the tag list here.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
      {notice && (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-1">New tag</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. B2B, Ocean, USA"
            maxLength={48}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-1">Color</label>
          <div className="flex gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
        >
          Add tag
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-gray-500">Loading tags…</p>
      ) : tags.length === 0 ? (
        <p className="text-xs text-gray-500">No tags yet. Add your first tag above.</p>
      ) : (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 bg-gray-50/80"
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              {editingId === tag.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                    maxLength={48}
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(tag.id)}
                    disabled={busy}
                    className="text-xs font-semibold text-gray-900"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-800">{tag.name}</span>
                  <button type="button" onClick={() => startEdit(tag)} className="text-xs text-gray-500 hover:text-gray-800">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    disabled={busy}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
