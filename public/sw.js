// Admin order-alert service worker.
//
// Only registered from the admin portal (see AdminLayout.jsx), so customers
// never get it. It does NOT cache anything and does not touch page loads —
// its only jobs are:
//   1. show a system notification when the server pushes a "new order"
//      message (works with the app closed, as long as the phone allows it),
//   2. tell any open admin page to play the cha-ching sound (a web push
//      can't carry a custom sound itself — only an open page can play one),
//   3. open the order when the notification is tapped.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Pass-through: present only so browsers that still require a fetch handler
// treat the admin shortcut as installable. It never calls respondWith().
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'طلب جديد'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32x32.png',
    tag: data.tag || 'new-order',
    renotify: true,
    vibrate: [200, 100, 200, 100, 400],
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || '/admin/orders' },
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      windows.forEach((client) => client.postMessage({ type: 'new-order', orderId: data.orderId || null }))
      // Browsers require a visible notification for every push.
      await self.registration.showNotification(title, options)
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/admin/orders'

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(target)
            } catch {
              // ignore — focusing is enough
            }
          }
          return
        }
      }
      await self.clients.openWindow(target)
    })()
  )
})
