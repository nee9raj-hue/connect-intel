import { useId } from 'react'
import useCrmAiFabLayout from '../../hooks/useCrmAiFabLayout'

/** AI copilot mark — sparkles + assistant ring (reads at 16–28px). */
function CrmAiIcon({ className = 'w-6 h-6' }) {
  const uid = useId().replace(/:/g, '')
  const grad = `ci-copilot-grad-${uid}`
  const glow = `ci-copilot-glow-${uid}`

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffcb2b" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <radialGradient id={glow} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12 12) rotate(90) scale(9)">
          <stop stopColor="#ffcb2b" stopOpacity="0.35" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="12" cy="12" r="9.5" fill={`url(#${glow})`} />
      <circle cx="12" cy="12" r="8.5" stroke={`url(#${grad})`} strokeWidth="1.25" strokeOpacity="0.55" />

      <path
        d="M12 6.2l1.05 3.25h3.4l-2.75 2 1.05 3.25L12 12.9 9.25 14.7l1.05-3.25-2.75-2h3.4L12 6.2Z"
        fill={`url(#${grad})`}
      />
      <path
        d="M17.6 5.4l.55 1.7h1.8l-1.45 1.05.55 1.7-1.45-1.05-1.45 1.05.55-1.7-1.45-1.05h1.8l.55-1.7Z"
        fill="#ffcb2b"
        opacity="0.95"
      />
      <path
        d="M6.1 15.8l.45 1.4h1.45l-1.2.88.45 1.4-1.2-.88-1.2.88.45-1.4-1.2-.88h1.45l.45-1.4Z"
        fill="#c4b5fd"
        opacity="0.9"
      />

      <path
        d="M8.2 9.8c1.2-.9 2.6-1.1 3.8-.5"
        stroke="#ffcb2b"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
      <circle cx="16.8" cy="16.2" r="1" fill="#ffcb2b" opacity="0.85" />
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
