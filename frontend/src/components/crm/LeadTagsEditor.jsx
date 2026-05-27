import { useMemo, useState } from 'react'
import { toggleTagId } from '../../lib/orgLeadTags'

export default function LeadTagsEditor({ lead, orgLeadTags, onSave, readOnly = false }) {
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => new Set(lead?.crm?.tagIds || []), [lead?.crm?.tagIds])

  const selectedTags = useMemo(
    () => (orgLeadTags || []).filter((t) => selected.has(t.id)),
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
    try {
      await onSave(nextIds)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const toggle = (tagId) => {
    const next = toggleTagId([...selected], tagId)
    void apply(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.length === 0 ? (
          <span className="text-xs text-gray-400">No tags</span>
        ) : (
          selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => toggle(tag.id)}
                  className="opacity-80 hover:opacity-100 leading-none"
                  aria-label={`Remove ${tag.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={saving}
            className="text-xs font-semibold px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            {open ? 'Done' : '+ Tag'}
          </button>
        )}
      </div>
      {open && !readOnly && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-gray-200 bg-gray-50">
          {orgLeadTags.map((tag) => {
            const on = selected.has(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                disabled={saving}
                onClick={() => toggle(tag.id)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  on ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
                style={on ? { backgroundColor: tag.color } : undefined}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
