/* Chithi Web Push handlers — imported by the Workbox service worker. */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Chithi',
    body: 'New team message',
    url: '/?panel=chithi',
    tag: 'chithi',
    icon: '/pwa-192.png',
  }

  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = { ...payload, ...parsed }
    }
  } catch {
    // ignore malformed payloads
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Chithi', {
      body: payload.body || '',
      icon: payload.icon || '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: payload.tag || 'chithi',
      data: { url: payload.url || '/?panel=chithi' },
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetPath = event.notification.data?.url || '/?panel=chithi'
  const targetUrl = new URL(targetPath, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          try {
            if ('navigate' in client) {
              return client.navigate(targetUrl).then(() => client.focus())
            }
          } catch {
            // fall through
          }
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})
