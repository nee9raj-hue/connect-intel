/** Native shell hooks — no-op in browser/PWA builds (Capacitor not bundled on Vercel). */
export async function initNativeAppShell() {
  if (typeof window === 'undefined' || !window.Capacitor?.isNativePlatform?.()) return
  // When building the Android app locally, extend here with @capacitor/* plugins.
}
