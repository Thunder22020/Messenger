import { API_URL } from "../config";
import { authFetch } from "./authFetch";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function toBase64Url(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    const reg = await navigator.serviceWorker.register('/custom-sw.js', { scope: '/' });
    // Wait until the SW is active (handles first install + updates)
    await navigator.serviceWorker.ready;
    return reg;
}

export async function initPushNotifications(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidPublicKey) {
        console.warn('[push] VITE_VAPID_PUBLIC_KEY is not set');
        return;
    }

    try {
        const registration = await registerServiceWorker();

        const permission = Notification.permission === 'default'
            ? await Notification.requestPermission()
            : Notification.permission;

        if (permission !== 'granted') return;

        let sub = await registration.pushManager.getSubscription();
        if (!sub) {
            sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });
        }

        const p256dh = sub.getKey('p256dh');
        const auth   = sub.getKey('auth');
        if (!p256dh || !auth) return;

        await authFetch(`${API_URL}/api/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: sub.endpoint,
                p256dh:   toBase64Url(p256dh),
                auth:     toBase64Url(auth),
            }),
        });
    } catch (err) {
        console.warn('[push] init failed:', err);
    }
}

export async function unsubscribePush(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;
        const sub = await registration.pushManager.getSubscription();
        if (!sub) return;
        await authFetch(`${API_URL}/api/push/subscribe`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint, p256dh: '', auth: '' }),
        });
        await sub.unsubscribe();
    } catch (err) {
        console.warn('[push] unsubscribe failed:', err);
    }
}
