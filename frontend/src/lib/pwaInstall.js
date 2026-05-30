const DISMISS_KEY = 'ci_pwa_install_dismissed'

function displayModeSupported() {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(display-mode: browser)').media !== 'not all'
  } catch {
    return false
  }
}

/** True when the app runs from a home-screen / installed shell (not a normal browser tab). */
export function isPwaStandalone() {
  if (typeof window === 'undefined') return false

  // iOS Safari “Add to Home Screen”
  if (window.navigator.standalone === true) return true

  const installedModes = ['standalone', 'fullscreen', 'minimal-ui']
  for (const mode of installedModes) {
    try {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) return true
    } catch {
      // ignore
    }
  }

  // When display-mode is supported and the session is not a browser tab, treat as installed PWA.
  if (displayModeSupported() && !window.matchMedia('(display-mode: browser)').matches) {
    return true
  }

  return false
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isIos && isSafari
}

export function isPwaInstallDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissPwaInstallPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

/** @returns {boolean} true when the install banner may be shown */
export function shouldOfferPwaInstall() {
  if (typeof window === 'undefined') return false
  if (isPwaStandalone()) return false
  if (isPwaInstallDismissed()) return false
  return true
}
