export const COPILOT_ICON_SRC = '/connect-copilot-icon.png'

/** Connect Copilot brand mark (header + panel). Floating FAB removed. */
function CrmAiIcon({ className = 'ci-copilot-icon' }) {
  return (
    <img
      src={COPILOT_ICON_SRC}
      alt=""
      aria-hidden
      className={className}
      width={24}
      height={24}
      decoding="async"
      draggable={false}
    />
  )
}

export { CrmAiIcon }
export default CrmAiIcon
