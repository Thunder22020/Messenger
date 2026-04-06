// Kill-switch: clears legacy Workbox cache and unregisters this SW.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.navigate(client.url));
});
