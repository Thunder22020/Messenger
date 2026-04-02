self.addEventListener('push', event => {
    if (!event.data) return;

    let data;
    try { data = event.data.json(); } catch { return; }

    const title = data.title ?? 'Synk.';
    const options = {
        body: data.body ?? '',
        icon: '/icons/icon-192.png',
        data: { url: `/chat/${data.chatId}` },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url ?? '/chat';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            // Focus existing window if open
            for (const client of list) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.focus();
                    if ('navigate' in client) client.navigate(url);
                    return;
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
