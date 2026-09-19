/**
 * Read-only ERP tag chip — uses ERP-provided hex color (not CRM org tags).
 */
export default function ErpTagChip({ name, color = '#64748b', type, className = '', title }) {
  if (!name) return null
  const bg = color || '#64748b'
  const tip = title || (type ? `${name} (${type})` : name)
  return (
    <span
      className={`ci-erp-tag ${className}`.trim()}
      style={{
        backgroundColor: bg,
        borderColor: bg,
      }}
      title={tip}
      aria-label={`ERP tag: ${name}`}
    >
      {name}
    </span>
  )
}
