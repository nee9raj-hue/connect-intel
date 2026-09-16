import { useEffect, useMemo, useState } from 'react'
import { toggleTagId } from '../../lib/orgLeadTags'
import LeadTag from '../ui/LeadTag'

export default function LeadTagsEditor({ lead, orgLeadTags, onSave, readOnly = false }) {
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)
  const [pendingIds, setPendingIds] = useState(null)
  const leadId = lead?.id
  const serverIds = (lead?.crm?.tagIds || []).map(String)

  useEffect(() => {
    setPendingIds(null)
    setError(null)
    setOpen(false)
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

  if (!orgLeadTags?.length) {
    return (
      <div className="text-xs text-gray-500">
        No company tags yet. Ask your admin to create tags under <strong>Team → Lead tags</strong>.
      </div>
    )
  }

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
        <div className="ci-lead-tags p-2 rounded-lg border border-gray-200 bg-gray-50">
          {orgLeadTags.map((tag) => (
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
      )}
    </div>
  )
}
