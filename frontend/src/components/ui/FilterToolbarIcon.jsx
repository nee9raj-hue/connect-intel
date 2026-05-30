/**
 * Icon-only toolbar control with hover tooltip (desktop) and accessible label.
 */
export default function FilterToolbarIcon({
  src = null,
  icon: Icon = null,
  label,
  active = false,
  onClick,
  className = '',
  type = 'button',
  badge = false,
  children = null,
  showLabel = false,
  'aria-expanded': ariaExpanded,
}) {
  const Tag = type === 'button' ? 'button' : 'div'
  return (
    <Tag
      type={type === 'button' ? 'button' : undefined}
      className={`hs-filter-icon-btn ${showLabel ? 'hs-filter-icon-btn--labeled' : ''} ${active ? 'is-active' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      aria-expanded={ariaExpanded}
      data-tooltip={showLabel ? undefined : label}
    >
      {children || (Icon ? (
        <Icon className="hs-filter-icon-btn__svg shrink-0" aria-hidden />
      ) : (
        <img src={src} alt="" className="ci-ui-icon" draggable={false} aria-hidden />
      ))}
      {showLabel && label ? <span className="hs-filter-icon-btn__label">{label}</span> : null}
      {badge ? <span className="hs-filter-icon-btn__dot" aria-hidden /> : null}
    </Tag>
  )
}
