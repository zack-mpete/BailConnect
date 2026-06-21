self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'LeaseHub RDC', body: 'Nouvelle notification' };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icon.svg', data: { url: data.url || '/' } }));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(self.clients.openWindow(url));
});
