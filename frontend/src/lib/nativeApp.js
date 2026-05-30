/** Native Android/iOS shell tweaks (status bar, splash, hardware back). No-op in browser/PWA. */
export async function initNativeAppShell() {
  if (typeof window === 'undefined' || !window.Capacitor?.isNativePlatform?.()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#17191c' })
  } catch {
    // ignore — plugin unavailable in browser builds
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    // ignore
  }

  try {
    const { App } = await import('@capacitor/app')
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else App.minimizeApp()
    })
  } catch {
    // ignore
  }
}
