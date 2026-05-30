export default function MarketingCreatorBadge({ name, isOwn, className = '' }) {
  if (!name) return null
  const label = isOwn ? 'You' : name
  const styles = isOwn
    ? 'bg-gray-100 text-gray-600 border-gray-200'
    : 'bg-violet-50 text-violet-800 border-violet-100'
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${styles} ${className}`}
      title={isOwn ? 'Your marketing asset' : `Created by ${name}`}
    >
      {label}
    </span>
  )
}

export function marketingOptionLabel(item) {
  const base = item.name || 'Untitled'
  if (!item.createdByName || item.isOwn) return base
  return `${base} · ${item.createdByName}`
}
