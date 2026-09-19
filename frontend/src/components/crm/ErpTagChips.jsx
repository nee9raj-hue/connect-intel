import { erpTagChipTextColor, readErpTagsFromLead } from '../../../../lib/erpTags.js'

export default function ErpTagChips({ lead, max = 6, className = '' }) {
  const tags = readErpTagsFromLead(lead)
  if (!tags.length) return null
  const extra = tags.length > max ? tags.length - max : 0
  return (
    <div className={`ci-erp-tags ${className}`.trim()} title="ERP tags">
      {tags.slice(0, max).map((tag) => {
        const bg = tag.color || '#eaf0f6'
        return (
          <span
            key={`${tag.name}-${tag.type || 'erp'}`}
            className="ci-erp-tag"
            style={{
              background: bg,
              borderColor: tag.color || '#cbd6e2',
              color: erpTagChipTextColor(bg),
            }}
            title={
              tag.type === 'automatic'
                ? `${tag.name} · ERP automatic`
                : tag.type === 'manual'
                  ? `${tag.name} · ERP manual`
                  : `${tag.name} · ERP`
            }
          >
            {tag.name}
          </span>
        )
      })}
      {extra > 0 ? <span className="ci-lead-tags-more">+{extra}</span> : null}
    </div>
  )
}
