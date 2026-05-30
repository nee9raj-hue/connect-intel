import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import {
  dismissChithiPushPrompt,
  isChithiPushDismissed,
  isPushSupported,
  readLocalPushSubscription,
  subscriptionToJson,
  urlBase64ToUint8Array,
  getServiceWorkerRegistration,
} from '../lib/chithiPush'
import { isPwaStandalone } from '../lib/pwaInstall'

export default function useChithiPush({ enabled = true } = {}) {
  const [supported, setSupported] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [showPrompt, setShowPrompt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refreshStatus = useCallback(async () => {
    if (!enabled || !isPushSupported()) {
      setSupported(false)
      return
    }
    setSupported(true)
    try {
      const data = await api.getChithiPushConfig()
      setConfigured(Boolean(data.configured && data.vapidPublicKey))
      setSubscribed(Boolean(data.subscribed))
      const local = await readLocalPushSubscription()
      if (local && data.configured) setSubscribed(true)
      setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default')
    } catch {
      setConfigured(false)
    }
  }, [enabled])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const subscribe = useCallback(async () => {
    if (!configured) return false
    setBusy(true)
    setError(null)
    try {
      const data = await api.getChithiPushConfig()
      const vapidPublicKey = data.vapidPublicKey
      if (!vapidPublicKey) throw new Error('Push is not configured on the server.')

      let perm = Notification.permission
      if (perm === 'default') {
        perm = await Notification.requestPermission()
      }
      setPermission(perm)
      if (perm !== 'granted') {
        throw new Error('Notification permission was not granted.')
      }

      const reg = await getServiceWorkerRegistration()
      if (!reg?.pushManager) throw new Error('Service worker is not ready yet.')

      let subscription = await reg.pushManager.getSubscription()
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      await api.subscribeChithiPush(subscriptionToJson(subscription))
      setSubscribed(true)
      setShowPrompt(false)
      return true
    } catch (e) {
      setError(e.message || 'Could not enable Chithi notifications')
      return false
    } finally {
      setBusy(false)
    }
  }, [configured])

  useEffect(() => {
    if (!enabled || !supported || !configured || subscribed) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    void subscribe()
  }, [enabled, supported, configured, subscribed, subscribe])

  useEffect(() => {
    if (!enabled || !supported || !configured) {
      setShowPrompt(false)
      return
    }
    if (subscribed) {
      setShowPrompt(false)
      return
    }
    if (isChithiPushDismissed()) {
      setShowPrompt(false)
      return
    }
    setShowPrompt(true)
  }, [enabled, supported, configured, subscribed])

  const unsubscribe = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const subscription = await readLocalPushSubscription()
      if (subscription) {
        const json = subscriptionToJson(subscription)
        if (json?.endpoint) await api.unsubscribeChithiPush(json.endpoint)
        await subscription.unsubscribe()
      }
      setSubscribed(false)
      return true
    } catch (e) {
      setError(e.message || 'Could not turn off notifications')
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const dismiss = useCallback(() => {
    dismissChithiPushPrompt()
    setShowPrompt(false)
  }, [])

  const isInstalledPwa = isPwaStandalone()

  return {
    supported,
    configured,
    subscribed,
    permission,
    showPrompt,
    busy,
    error,
    isInstalledPwa,
    subscribe,
    unsubscribe,
    dismiss,
    refreshStatus,
  }
}
