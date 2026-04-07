import { createContext, useContext, useEffect, useState } from "react";
import { useWebSocket } from "./WebSocketContext";
import { authFetch } from "../utils/authFetch";
import { API_URL } from "../config";

const HEARTBEAT_INTERVAL_MS = 30_000;

interface PresenceContextValue {
    isOnline: (username: string) => boolean;
    getLastSeen: (username: string) => string | null;
}

const PresenceContext = createContext<PresenceContextValue>({
    isOnline: () => false,
    getLastSeen: () => null,
});

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [lastSeenMap, setLastSeenMap] = useState<Map<string, string>>(new Map());
    const client = useWebSocket();

    // Fetch initial online set on mount
    useEffect(() => {
        if (!localStorage.getItem("accessToken")) return;
        authFetch(`${API_URL}/api/users/online`)
            .then(r => r?.json())
            .then((names: string[]) => {
                if (Array.isArray(names)) setOnlineUsers(new Set(names));
            })
            .catch(() => {});
    }, []);

    // Heartbeat + presence subscription
    useEffect(() => {
        if (!client) return;

        // Flag-based gate: flipped by all relevant browser lifecycle events.
        // The interval keeps running so there's no start/stop complexity,
        // but sendHeartbeat is a no-op while active === false.
        let active = document.visibilityState === "visible";

        const sendHeartbeat = () => {
            if (!active) return;
            client.publish({ destination: "/app/presence.heartbeat", body: "{}" });
        };

        // Send immediately on connect if the tab is already visible
        sendHeartbeat();

        const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                active = true;
                sendHeartbeat(); // restore online status immediately, don't wait for next tick
            } else {
                active = false;
            }
        };

        // pagehide fires when the page is put into bfcache or unloaded (tab close, navigation).
        // beforeunload is a final safety net for hard navigations that skip bfcache.
        const stopHeartbeat = () => { active = false; };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("pagehide", stopHeartbeat);
        window.addEventListener("beforeunload", stopHeartbeat);

        const sub = client.subscribe("/topic/presence", (msg) => {
            const ev: { username: string; online: boolean; lastSeenAt?: string } = JSON.parse(msg.body);
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (ev.online) next.add(ev.username);
                else next.delete(ev.username);
                return next;
            });
            if (!ev.online && ev.lastSeenAt) {
                setLastSeenMap(prev => new Map(prev).set(ev.username, ev.lastSeenAt!));
            }
        });

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("pagehide", stopHeartbeat);
            window.removeEventListener("beforeunload", stopHeartbeat);
            sub.unsubscribe();
        };
    }, [client]);

    return (
        <PresenceContext.Provider value={{
            isOnline: (u) => onlineUsers.has(u),
            getLastSeen: (u) => lastSeenMap.get(u) ?? null,
        }}>
            {children}
        </PresenceContext.Provider>
    );
}

export const usePresence = () => useContext(PresenceContext);
