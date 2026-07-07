/** Global event to open Connect Intel AI from any shell surface. */
export const CI_OPEN_AI_EVENT = 'ci-open-ai'

export function openConnectAI() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CI_OPEN_AI_EVENT))
}
