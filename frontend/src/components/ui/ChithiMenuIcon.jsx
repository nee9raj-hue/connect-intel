/**
 * Chithi menu icon — white on dark backgrounds (CRM sidebar); black on light panels.
 */
export default function ChithiMenuIcon({ className = '', onLight = false }) {
  const toneClass = onLight ? 'ci-chithi-menu-icon--on-light' : 'ci-chithi-menu-icon--on-dark'

  return (
    <svg
      className={`ci-chithi-menu-icon ${toneClass} ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="11" r="1.05" fill="currentColor" />
      <circle cx="12" cy="11" r="1.05" fill="currentColor" />
      <circle cx="15" cy="11" r="1.05" fill="currentColor" />
    </svg>
  )
}
