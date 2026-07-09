import { useEffect, useState } from 'react'
import { api } from './api'

let cachedDistribution = null

/** Chrome extension store URL + version (public-config + bootstrap). */
export async function loadChromeExtensionDistribution() {
  if (cachedDistribution) return cachedDistribution

  const [bootResult, publicResult] = await Promise.allSettled([
    api.getExtensionBootstrap(),
    api.getPublicConfig(),
  ])

  const boot =
    bootResult.status === 'fulfilled' ? bootResult.value?.distribution || bootResult.value : null
  const pub =
    publicResult.status === 'fulfilled' ? publicResult.value?.chromeExtension : null

  cachedDistribution = {
    storeUrl: boot?.chromeWebStoreUrl || pub?.storeUrl || null,
    version: boot?.extensionVersion || pub?.version || '1.2.0',
    installGuideUrl: boot?.installGuideUrl || pub?.installGuideUrl || 'https://connectintel.net',
  }
  return cachedDistribution
}

export function useChromeExtensionDistribution() {
  const [distribution, setDistribution] = useState(cachedDistribution)

  useEffect(() => {
    let cancelled = false
    loadChromeExtensionDistribution()
      .then((dist) => {
        if (!cancelled) setDistribution(dist)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    distribution || {
      storeUrl: null,
      version: '1.2.0',
      installGuideUrl: 'https://connectintel.net',
    }
  )
}

export function openChromeWebStore(storeUrl) {
  if (!storeUrl) return false
  window.open(storeUrl, '_blank', 'noopener,noreferrer')
  return true
}
