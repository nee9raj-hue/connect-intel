const MOBILE_SPLIT_MQ = '(max-width: 767px)'

export function isMobileSplitViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_SPLIT_MQ).matches
}

/** Scroll a .crm-split-card container so the detail pane fills the screen (list off to the left). */
export function scrollMobileSplitToDetail(container) {
  if (!container || !isMobileSplitViewport()) return
  const main = container.querySelector('.crm-split-main')
  const left = main ? main.offsetLeft : container.clientWidth
  container.scrollTo({ left, behavior: 'smooth' })
}

/** Scroll back to the list pane (first snap). */
export function scrollMobileSplitToList(container) {
  if (!container || !isMobileSplitViewport()) return
  container.scrollTo({ left: 0, behavior: 'smooth' })
}
