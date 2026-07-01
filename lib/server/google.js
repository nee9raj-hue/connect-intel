import { isProduction } from './config.js'
import { CRM_SOLO_FREE_TIER } from './crmProductFlags.js'

export async function verifyGoogleCredential(credential) {
  if (!credential) throw new Error('Missing Google credential')

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  )

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Google token verification failed')
  }

  const expectedClientId = String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  if (expectedClientId && payload.aud !== expectedClientId) {
    throw new Error('Google token audience mismatch')
  }

  if (!payload.email) {
    throw new Error('Google account email not available')
  }

  return {
    name: payload.name || payload.email.split('@')[0] || 'User',
    email: payload.email,
    company: payload.hd ? payload.hd.replace(/\./g, ' ') : 'Your Company',
    picture: payload.picture || null,
    plan: 'free',
    searchesLeft: CRM_SOLO_FREE_TIER ? 0 : 25,
    authProvider: 'google',
  }
}

export function verifyDemoProfile(profile) {
  if (isProduction()) {
    throw new Error('Demo auth is disabled in production')
  }

  if (!profile?.email) {
    throw new Error('Missing demo email')
  }

  return {
    name: profile.name || profile.email.split('@')[0] || 'User',
    email: profile.email,
    company: profile.company || 'Demo Company',
    picture: profile.picture || null,
    plan: profile.plan || 'free',
    searchesLeft: CRM_SOLO_FREE_TIER ? 0 : 25,
    authProvider: profile.authProvider || 'demo',
  }
}

