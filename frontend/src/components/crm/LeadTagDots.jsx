import LeadTag from '../ui/LeadTag'
import ErpTagChips from './ErpTagChips'
import { readErpTagsFromLead } from '../../../../lib/erpTags.js'

export default function LeadTagDots({ lead, tagById, max = 4, className = '' }) {
  const tags = (lead.crm?.tagIds || []).map((id) => tagById?.get?.(id)).filter(Boolean)
  const hasCrm = tags.length > 0
  const hasErp = readErpTagsFromLead(lead).length > 0
  if (!hasCrm && !hasErp) return null
  return (
    <div className={`ci-lead-tags-stack ${className}`.trim()}>
      <ErpTagChips lead={lead} max={max} />
      {hasCrm ? (
        <div className="ci-lead-tags">
          {tags.slice(0, max).map((tag) => (
            <LeadTag key={tag.id} name={tag.name} title={tag.name} />
          ))}
          {tags.length > max && <span className="ci-lead-tags-more">+{tags.length - max}</span>}
        </div>
      ) : null}
    </div>
  )
}
