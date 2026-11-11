// PaceTracker service worker. For now it only needs to exist so the app can be installed;
// push notification handlers will be added here when reminders ship.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
