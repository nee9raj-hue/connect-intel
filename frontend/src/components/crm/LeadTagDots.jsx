import LeadTag from '../ui/LeadTag'
import ErpTagChips from './ErpTagChips'
import { readDisplayErpTagsFromLead } from '../../lib/erpTags'

export default function LeadTagDots({ lead, tagById, max = 4, className = '' }) {
  const crmTags = tagById?.size
    ? (lead.crm?.tagIds || []).map((id) => tagById.get(id)).filter(Boolean)
    : []
  const erpTags = readDisplayErpTagsFromLead(lead)
  if (!crmTags.length && !erpTags.length) return null

  return (
    <div className={`ci-lead-tags-stack ${className}`.trim()}>
      {crmTags.length ? (
        <div className="ci-lead-tags">
          {crmTags.slice(0, max).map((tag) => (
            <LeadTag key={tag.id} name={tag.name} title={tag.name} />
          ))}
          {crmTags.length > max && <span className="ci-lead-tags-more">+{crmTags.length - max}</span>}
        </div>
      ) : null}
      {erpTags.length ? <ErpTagChips lead={lead} max={max} /> : null}
    </div>
  )
}
