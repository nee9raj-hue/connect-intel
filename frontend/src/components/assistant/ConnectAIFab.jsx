import useCrmAiFabLayout from '../../hooks/useCrmAiFabLayout'

function CrmAiIcon({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="ci-ai-fab-grad" x1="4" y1="4" x2="20" y2="20">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ff773d" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke="url(#ci-ai-fab-grad)" strokeWidth="1.6" />
      <path
        d="M8 12.5c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4"
        stroke="url(#ci-ai-fab-grad)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="9.5" cy="11" r="0.9" fill="#6366f1" />
      <circle cx="14.5" cy="11" r="0.9" fill="#8b5cf6" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
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
          <CrmAiIcon className="w-7 h-7" />
        )}
      </span>
      {!open ? <span className="ci-ai-fab__label">Copilot</span> : null}
    </button>
  )
}

export { CrmAiIcon }
