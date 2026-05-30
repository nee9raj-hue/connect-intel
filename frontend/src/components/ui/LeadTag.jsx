/**
 * Company lead tag — outline pill, no fill color (used everywhere tags are shown).
 */
export default function LeadTag({
  name,
  children,
  active = false,
  className = '',
  as: Component = 'span',
  ...rest
}) {
  const label = name ?? children
  const classes = ['ci-lead-tag', active ? 'ci-lead-tag--active' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <Component className={classes} {...rest}>
      {label}
    </Component>
  )
}
