import LeadTag from '../ui/LeadTag'

export default function LeadTagDots({ lead, tagById, max = 4, className = '' }) {
  if (!tagById?.size) return null
  const tags = (lead.crm?.tagIds || []).map((id) => tagById.get(id)).filter(Boolean)
  if (!tags.length) return null
  return (
    <div className={`ci-lead-tags ${className}`.trim()}>
      {tags.slice(0, max).map((tag) => (
        <LeadTag key={tag.id} name={tag.name} title={tag.name} />
      ))}
      {tags.length > max && <span className="ci-lead-tags-more">+{tags.length - max}</span>}
    </div>
  )
}
