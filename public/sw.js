self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'BailConnect', body: 'Nouvelle notification' };
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title, { body: data.body, icon: '/icon.svg', data: { url: data.url || '/' } }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({ type: 'bailconnect-notification', notification: data });
      });
    })
  ]));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const requestedUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  const url = typeof requestedUrl === 'string' && requestedUrl.startsWith('/') && !requestedUrl.startsWith('//') ? requestedUrl : '/';
  event.waitUntil(self.clients.openWindow(url));
});
