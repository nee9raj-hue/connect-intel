import { useEffect, useState } from 'react'
import { api } from './api'
import { GMAIL_ONBOARDING_PROMPT_ENABLED } from './crmProductFlags'

let cachedConfig = null

const DEFAULT_CONFIG = {
  promptEnabled: GMAIL_ONBOARDING_PROMPT_ENABLED,
  connectAvailable: false,
  phase: 'pending_verification',
  verified: false,
}

/** Runtime Gmail onboarding flags from /api/public-config (Vercel env). */
export async function loadGmailOnboardingConfig() {
  if (cachedConfig) return cachedConfig

  try {
    const pub = await api.getPublicConfig()
    const gmail = pub?.gmailOnboarding || {}
    cachedConfig = {
      promptEnabled: Boolean(gmail.promptEnabled ?? GMAIL_ONBOARDING_PROMPT_ENABLED),
      connectAvailable: Boolean(gmail.connectAvailable),
      phase: gmail.phase || 'pending_verification',
      verified: Boolean(gmail.verified),
    }
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG }
  }

  return cachedConfig
}

export function useGmailOnboardingConfig() {
  const [config, setConfig] = useState(cachedConfig)

  useEffect(() => {
    let cancelled = false
    loadGmailOnboardingConfig()
      .then((next) => {
        if (!cancelled) setConfig(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return config || DEFAULT_CONFIG
}
