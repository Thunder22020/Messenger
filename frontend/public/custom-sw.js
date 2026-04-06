self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        return;
    }

    const { title = 'Synk.', body = '', chatId } = payload;

    const options = {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: chatId != null ? `chat-${chatId}` : 'synk',
        renotify: true,
        data: { url: chatId != null ? `/chat/${chatId}` : '/' },
    };

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            const appFocused = windowClients.some((c) => c.focused);
            if (appFocused) return;
            return self.registration.showNotification(title, options);
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url ?? '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    if ('navigate' in client) client.navigate(url);
                    return client.focus();
                }
            }
            return clients.openWindow?.(url);
        })
    );
});
