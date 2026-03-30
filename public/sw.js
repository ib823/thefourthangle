const CACHE_NAME = 'v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // HTML: always network-first, never serve stale
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Hashed assets (_a/): cache forever (immutable by hash)
  if (url.pathname.startsWith('/_a/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Fonts: cache-first (they don't change)
  if (url.pathname.startsWith('/fonts/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ── Push Notifications ──

const NOTIFY_API = 'https://tfa-notify.4thangle.workers.dev';

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/badge-96.png',
      image: data.image,
      tag: data.tag || 'tfa-default',
      data: data.data || {},
      actions: data.actions || [],
      requireInteraction: false,
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'The Fourth Angle', options).then(() => {
        // Notify all open clients to update their notification inbox
        return clients.matchAll({ type: 'window' }).then((windowClients) => {
          windowClients.forEach((client) => {
            client.postMessage({
              type: 'NOTIFICATION_RECEIVED',
              title: data.title,
              body: data.body,
              issueId: data.data?.url?.match(/issue\/(\w+)/)?.[1] || '',
              url: data.data?.url || '/',
              timestamp: Date.now(),
            });
          });
        });
      })
    );
  } catch {
    event.waitUntil(
      self.registration.showNotification('The Fourth Angle', {
        body: event.data.text(),
        icon: '/icons/icon-192.png',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'dismiss') return;

  // Validate URL — only allow same-origin links (prevent XSS)
  var targetUrl = self.location.origin;
  if (data.url) {
    try {
      var parsed = new URL(data.url, self.location.origin);
      if (parsed.origin === new URL(self.location.origin).origin) {
        targetUrl = parsed.href;
      }
    } catch (e) {}
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open, focus it and navigate in-app
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE_TO', url: data.url || '/' });
          return client.focus();
        }
      }
      // No open tab — open new window
      return clients.openWindow(targetUrl);
    })
  );
});

// Heartbeat: update lastSeen on the notification server
// Clear notifications when app becomes visible
// Clear specific notification when its issue is opened
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'HEARTBEAT') {
    const endpoint = event.data.endpoint;
    if (endpoint) {
      fetch(NOTIFY_API + '/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  }

  if (event.data.type === 'APP_VISIBLE') {
    // Clear all T4A notifications when app is opened
    self.registration.getNotifications().then((notifications) => {
      notifications.forEach((n) => n.close());
    });
    // Clear badge count
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  if (event.data.type === 'ISSUE_OPENED') {
    var issueId = event.data.issueId;
    if (!issueId) return;
    // Clear only the exact notification for this issue (not partial matches)
    self.registration.getNotifications().then(function(notifications) {
      notifications.forEach(function(n) {
        if (n.data && n.data.url && (
          n.data.url === '/issue/' + issueId ||
          n.data.url.startsWith('/issue/' + issueId + '?')
        )) {
          n.close();
        }
      });
    });
  }
});
