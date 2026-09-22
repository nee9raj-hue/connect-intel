import { useEffect, useMemo, useState } from 'react'
import { toggleTagId } from '../../lib/orgLeadTags'
import { api } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import LeadTag from '../ui/LeadTag'

export default function LeadTagsEditor({ lead, orgLeadTags, onSave, readOnly = false, onNavigate }) {
  const { refreshOrgLeadTags } = useApp()
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)
  const [pendingIds, setPendingIds] = useState(null)
  const [newName, setNewName] = useState('')
  const leadId = lead?.id
  const serverIds = (lead?.crm?.tagIds || []).map(String)

  useEffect(() => {
    setPendingIds(null)
    setError(null)
    setOpen(false)
    setNewName('')
  }, [leadId])
  const serverKey = serverIds.join(',')
  const selected = useMemo(
    () => new Set(pendingIds || serverIds),
    [pendingIds, serverKey, serverIds]
  )

  const selectedTags = useMemo(
    () => (orgLeadTags || []).filter((t) => selected.has(String(t.id))),
    [orgLeadTags, selected]
  )

  const apply = async (nextIds) => {
    setSaving(true)
    setError(null)
    setPendingIds(nextIds.map(String))
    try {
      await onSave(nextIds.map(String))
      setOpen(false)
    } catch (err) {
      setPendingIds(null)
      setError(err?.message || 'Could not update tags')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (tagId) => {
    const next = toggleTagId([...selected], String(tagId))
    void apply(next)
  }

  const createTag = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError(null)
    try {
      const data = await api.createOrgLeadTag({ name })
      const created = data.tag || data.created?.[0]
      await refreshOrgLeadTags?.()
      setNewName('')
      if (created?.id) {
        const next = [...new Set([...selected, String(created.id)])]
        await onSave(next)
        setPendingIds(next)
      }
    } catch (err) {
      setError(err?.message || 'Could not create tag')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="ci-lead-tags">
        {selectedTags.length === 0 ? (
          <span className="text-xs text-gray-400">No tags</span>
        ) : (
          selectedTags.map((tag) => (
            <LeadTag key={tag.id} active title={tag.name}>
              {tag.name}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => toggle(tag.id)}
                  className="ci-lead-tag-remove"
                  aria-label={`Remove ${tag.name}`}
                >
                  ×
                </button>
              )}
            </LeadTag>
          ))
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={saving}
            className="text-xs font-semibold px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            {open ? 'Done' : '+ Tag'}
          </button>
        )}
      </div>
      {open && !readOnly && (
        <div className="p-2 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
          <div className="ci-lead-tags">
            {(orgLeadTags || []).map((tag) => (
              <LeadTag
                key={tag.id}
                as="button"
                type="button"
                name={tag.name}
                active={selected.has(String(tag.id))}
                disabled={saving}
                onClick={() => toggle(tag.id)}
              />
            ))}
          </div>
          <form onSubmit={createTag} className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New personal tag"
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
              maxLength={48}
            />
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="text-xs font-semibold px-2 py-1 bg-gray-900 text-white rounded disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {onNavigate ? (
            <button type="button" className="text-xs text-gray-500 underline" onClick={() => onNavigate('lead-tags')}>
              Manage all tags
            </button>
          ) : (
            <p className="text-[11px] text-gray-500">Create and edit your tags under CRM → Tags.</p>
          )}
        </div>
      )}
    </div>
  )
}
