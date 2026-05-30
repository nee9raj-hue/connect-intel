import { BRAND_UI_ICON_CLASS } from '../../lib/brandAssets'

/**
 * Icon-only toolbar control with hover tooltip (desktop) and accessible label.
 */
export default function FilterToolbarIcon({
  src,
  label,
  active = false,
  onClick,
  className = '',
  type = 'button',
  badge = false,
  'aria-expanded': ariaExpanded,
}) {
  const Tag = type === 'button' ? 'button' : 'div'
  return (
    <Tag
      type={type === 'button' ? 'button' : undefined}
      className={`hs-filter-icon-btn ${active ? 'is-active' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      aria-expanded={ariaExpanded}
      data-tooltip={label}
    >
      <img src={src} alt="" className={BRAND_UI_ICON_CLASS} draggable={false} aria-hidden />
      {badge ? <span className="hs-filter-icon-btn__dot" aria-hidden /> : null}
    </Tag>
  )
}
