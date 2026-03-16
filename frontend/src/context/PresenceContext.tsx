import { createContext, useContext, useEffect, useState } from "react";
import { useWebSocket } from "./WebSocketContext";
import { authFetch } from "../utils/authFetch";
import { API_URL } from "../config";

const HEARTBEAT_INTERVAL_MS = 30_000;

interface PresenceContextValue {
    isOnline: (username: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({ isOnline: () => false });

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
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

        const sendHeartbeat = () => {
            if (document.visibilityState === "visible") {
                client.publish({ destination: "/app/presence.heartbeat", body: "{}" });
            }
        };

        // Send immediately on connect (if tab is visible)
        sendHeartbeat();

        const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

        // When returning to tab, send a heartbeat right away so online status
        // is restored without waiting for the next interval tick
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") sendHeartbeat();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        const sub = client.subscribe("/topic/presence", (msg) => {
            const ev: { username: string; online: boolean } = JSON.parse(msg.body);
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (ev.online) next.add(ev.username);
                else next.delete(ev.username);
                return next;
            });
        });

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            sub.unsubscribe();
        };
    }, [client]);

    return (
        <PresenceContext.Provider value={{ isOnline: (u) => onlineUsers.has(u) }}>
            {children}
        </PresenceContext.Provider>
    );
}

export const usePresence = () => useContext(PresenceContext);
