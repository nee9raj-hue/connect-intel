import useCrmAiFabLayout from '../../hooks/useCrmAiFabLayout'

export const COPILOT_ICON_SRC = '/connect-copilot-icon.png'

/** Connect Copilot brand mark */
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

export default function ConnectAIFab({
  open,
  onOpen,
  isMobile,
  mobilePillVisible,
  hidden = false,
}) {
  const { bottom, right, shiftUp } = useCrmAiFabLayout({
    enabled: !hidden,
    isMobile,
    mobilePillVisible,
  })

  if (hidden) return null

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`ci-ai-fab${open ? ' is-open' : ''}${shiftUp ? ' is-shifted' : ''}`}
      style={{ bottom, right }}
      aria-expanded={open}
      aria-label={open ? 'Close Connect Copilot' : 'Open Connect Copilot'}
      title="Connect Copilot — CRM & web research"
    >
      <span className="ci-ai-fab__glow" aria-hidden />
      <span className="ci-ai-fab__inner">
        {open ? (
          <span className="ci-ai-fab__close" aria-hidden>
            ✕
          </span>
        ) : (
          <CrmAiIcon className="ci-copilot-icon ci-copilot-icon--fab" />
        )}
      </span>
      {!open ? <span className="ci-ai-fab__label">Copilot</span> : null}
    </button>
  )
}

export { CrmAiIcon }
