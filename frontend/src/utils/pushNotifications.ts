import { API_URL } from "../config";
import { authFetch } from "./authFetch";

/** Converts a VAPID Base64URL public key to the Uint8Array format required by PushManager. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/**
 * Registers the service worker, requests notification permission, subscribes to
 * Web Push and sends the subscription to the backend. Safe to call on every mount -
 * re-uses an existing subscription if one is already active.
 */
export async function initPushNotifications(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidPublicKey) return;

    try {
        const registration = await navigator.serviceWorker.ready;

        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }
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
                p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
                auth:   btoa(String.fromCharCode(...new Uint8Array(auth))),
            }),
        });
    } catch (err) {
        // Non-fatal - app works without push notifications
        console.warn('[push] setup failed:', err);
    }
}
