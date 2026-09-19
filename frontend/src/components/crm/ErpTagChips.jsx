import ErpTagChip from '../ui/ErpTagChip'
import { readErpTagsFromLead } from '../../lib/erpTags'

export default function ErpTagChips({ lead, max, className = '', empty = null }) {
  const tags = readErpTagsFromLead(lead)
  if (!tags.length) return empty

  const visible = typeof max === 'number' ? tags.slice(0, max) : tags
  return (
    <div className={`ci-erp-tags ${className}`.trim()} aria-label="ERP tags">
      {visible.map((tag, index) => (
        <ErpTagChip
          key={`${tag.name}-${tag.color}-${index}`}
          name={tag.name}
          color={tag.color}
          type={tag.type}
        />
      ))}
      {typeof max === 'number' && tags.length > max ? (
        <span className="ci-erp-tags-more" title={tags.map((t) => t.name).join(', ')}>
          +{tags.length - max}
        </span>
      ) : null}
    </div>
  )
}
