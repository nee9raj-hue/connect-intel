import LeadTag from '../ui/LeadTag'

export default function MarketingSegmentTagFilter({
  orgLeadTags = [],
  tagIds = [],
  tagMode = 'any',
  onTagIdsChange,
  onTagModeChange,
}) {
  if (!orgLeadTags.length) return null

  const selected = new Set(tagIds || [])

  const toggle = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onTagIdsChange?.([...next])
  }

  return (
    <div className="marketing-segment-tag-filter sm:col-span-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[#516f90]">Lead tags</span>
        <select
          value={tagMode || 'any'}
          onChange={(e) => onTagModeChange?.(e.target.value)}
          className="ci-input text-xs py-1 px-2 w-auto"
          aria-label="Tag match mode"
        >
          <option value="any">Match any tag</option>
          <option value="all">Match all tags</option>
        </select>
      </div>
      <div className="marketing-segment-tag-filter__pills flex flex-wrap gap-2">
        {orgLeadTags.map((tag) => {
          const isOn = selected.has(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggle(tag.id)}
              className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                isOn
                  ? 'border-[#17191c] bg-[#f5f8fa]'
                  : 'border-[#dfe3eb] bg-white hover:border-[#99acc2]'
              }`}
            >
              <LeadTag name={tag.name} active={isOn} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
