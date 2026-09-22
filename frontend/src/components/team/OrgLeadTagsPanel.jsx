import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { parseTagNamesInput } from '../../lib/orgLeadTags'
import { useApp } from '../../context/AppContext'
import LeadTag from '../ui/LeadTag'

const PRESET_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#d97706',
  '#059669',
  '#4f46e5',
  '#64748B',
  '#dc2626',
]

function tagScopeLabel(tag, isAdmin) {
  if (tag?.visibility === 'personal' || tag?.source === 'personal') {
    return isAdmin && tag.createdByUserId ? 'Personal' : 'Only you'
  }
  if (tag?.teamId || tag?.source === 'org_team') return 'Team'
  return 'Company'
}

export default function OrgLeadTagsPanel({ onTagsChange, embedded = false }) {
  const { user, refreshOrgLeadTags } = useApp()
  const isAdmin = Boolean(user?.isOrgAdmin || user?.isPlatformAdmin)
  const [tags, setTags] = useState([])
  const [canManageCompanyTags, setCanManageCompanyTags] = useState(isAdmin)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const pendingNames = useMemo(() => parseTagNamesInput(name), [name])
  const isBulk = pendingNames.length > 1

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getOrgLeadTags()
      const next = data.tags || []
      setTags(next)
      setCanManageCompanyTags(Boolean(data.canManageCompanyTags ?? isAdmin))
      onTagsChange?.(next)
    } catch (e) {
      setError(e.message || 'Could not load tags')
    } finally {
      setLoading(false)
    }
  }, [onTagsChange, isAdmin])

  useEffect(() => {
    load()
  }, [load])

  const applyList = (next) => {
    setTags(next)
    onTagsChange?.(next)
    refreshOrgLeadTags?.()
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const names = parseTagNamesInput(name)
    if (!names.length) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload =
        names.length === 1 ? { name: names[0], color: color || PRESET_COLORS[0] } : { names }
      const data = await api.createOrgLeadTag(payload)
      applyList(data.tags || [])
      setName('')

      const created = data.created || (data.tag ? [data.tag] : [])
      const skipped = data.skipped || []
      if (created.length > 1) {
        setNotice(
          `Created ${created.length} tags${skipped.length ? ` (${skipped.length} skipped — already exist)` : ''}`
        )
      } else if (created.length === 1) {
        setNotice(`Tag “${created[0].name}” created`)
      } else if (skipped.length) {
        setError('Those tag names already exist')
      }
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
      applyList(data.tags || [])
      setEditingId(null)
      setNotice('Tag updated')
    } catch (e) {
      setError(e.message || 'Could not update tag')
    } finally {
      setBusy(false)
    }
  }

  const removeTag = async (tag) => {
    if (!window.confirm(`Delete tag “${tag.name}”? It will be removed from leads that use it.`)) return
    setBusy(true)
    setError(null)
    try {
      const data = await api.deleteOrgLeadTag(tag.id)
      applyList(data.tags || [])
      setNotice(`Tag “${tag.name}” deleted`)
    } catch (e) {
      setError(e.message || 'Could not delete tag')
    } finally {
      setBusy(false)
    }
  }

  const inner = (
    <>
      {!embedded && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Tags</h2>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            {isAdmin || canManageCompanyTags
              ? 'Your tags stay private to you. Company tags you create are shared. You can also see each rep’s personal tags.'
              : 'Tags you create here are only visible to you and workspace admins. Use them to filter Pipeline. Company and team tags stay shared.'}
          </p>
        </div>
      )}
      {embedded && (
        <p className="text-xs text-gray-500 leading-relaxed">
          {isAdmin
            ? 'Company tags are shared. Personal tags belong to one rep and are also visible to admins.'
            : 'Your tags are only for you and admins. Apply them on leads in Pipeline, then filter by Tags.'}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
      {notice && (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      <form onSubmit={handleCreate} className="space-y-2">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
            New tag{isBulk ? 's' : ''}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isAdmin ? 'VIP, Follow up' : 'My follow-ups, Hot this week'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          {pendingNames.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {isBulk
                ? `Will create ${pendingNames.length} tags`
                : isAdmin
                  ? 'Admins create a company tag unless you already use personal tags from this screen as a member'
                  : 'This tag will only be visible to you and admins'}
            </p>
          )}
        </div>

        {!isBulk && (
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Color</label>
            <div className="flex gap-1 flex-wrap">
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
        )}

        <button
          type="submit"
          disabled={busy || !pendingNames.length}
          className="text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
        >
          {busy ? 'Adding…' : isBulk ? `Add ${pendingNames.length} tags` : 'Add tag'}
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-gray-500">Loading tags…</p>
      ) : tags.length === 0 ? (
        <p className="text-xs text-gray-500">No tags yet. Add your first tag above.</p>
      ) : (
        <ul className="space-y-1.5 max-h-[28rem] overflow-y-auto">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 bg-gray-50/80"
            >
              <LeadTag name={tag.name} className="shrink-0" />
              <span className="text-[10px] uppercase tracking-wide text-gray-400">
                {tagScopeLabel(tag, isAdmin)}
              </span>
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
                  <span className="flex-1" />
                  {isAdmin || tag.canEdit ? (
                    <>
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
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )

  if (embedded) {
    return <div className="space-y-3">{inner}</div>
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {inner}
    </section>
  )
}
