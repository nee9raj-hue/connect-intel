import { useCallback, useEffect, useState } from 'react'
import { dismissPwaInstallPrompt, isIosSafari, isPwaStandalone, shouldOfferPwaInstall } from '../lib/pwaInstall'

export default function usePwaInstall({ enabled = true } = {}) {
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const ios = isIosSafari()

  useEffect(() => {
    if (!enabled || !shouldOfferPwaInstall()) {
      setVisible(false)
      return undefined
    }

    const onBeforeInstall = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setVisible(true)
    }

    const onInstalled = () => {
      setDeferredPrompt(null)
      setVisible(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    if (ios) setVisible(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [enabled, ios])

  useEffect(() => {
    if (isPwaStandalone()) setVisible(false)
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return false
    setInstalling(true)
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setVisible(false)
        setDeferredPrompt(null)
        return true
      }
      return false
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    dismissPwaInstallPrompt()
    setVisible(false)
  }, [])

  return {
    visible,
    installing,
    canNativeInstall: Boolean(deferredPrompt),
    isIos: ios,
    install,
    dismiss,
  }
}
