self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (x) {}
  e.waitUntil((async () => {
    const old = await self.registration.getNotifications({ tag: 'call' });
    old.forEach(n => n.close());
    if (d.type === 'missed') {
      return self.registration.showNotification('Missed call', {
        body: d.from + ' ka call miss ho gaya', tag: 'missed', icon: '/icon-192.png'
      });
    }
    return self.registration.showNotification('📞 Incoming call', {
      body: d.from + ' call kar raha hai',
      tag: 'call', renotify: true, requireInteraction: true,
      vibrate: [600, 300, 600, 300, 600, 300, 600, 300, 600],
      icon: '/icon-192.png', badge: '/icon-192.png', data: { from: d.from }
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow('/');
  }));
});
