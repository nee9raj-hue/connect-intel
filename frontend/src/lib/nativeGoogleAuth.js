import { Capacitor } from '@capacitor/core'

export function isNativeAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

let googleAuthReady = false

/** Google blocks OAuth inside Android WebViews — use the native Google Sign-In plugin. */
export async function signInWithNativeGoogle(clientId) {
  if (!clientId) throw new Error('Google sign-in is not configured for this app.')

  const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')

  if (!googleAuthReady) {
    GoogleAuth.initialize({
      clientId,
      scopes: ['profile', 'email'],
      grantOfflineAccess: false,
    })
    googleAuthReady = true
  }

  const result = await GoogleAuth.signIn()
  const idToken = result?.authentication?.idToken
  if (!idToken) throw new Error('Google did not return a sign-in token.')
  return idToken
}
