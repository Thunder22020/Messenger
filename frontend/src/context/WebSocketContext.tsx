import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";
import { WS_URL, API_URL } from "../config";
import { WebSocketContext } from "./WebSocketContext";

/**
 * Attempts to ensure localStorage has a valid (non-expired) access token.
 * Returns the token string or null if refresh failed (user must re-login).
 */
async function getFreshToken(): Promise<string | null> {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;

    // Decode JWT payload to check expiration (no library needed)
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const expiresAt = payload.exp * 1000; // seconds → ms
        // If token has >30s remaining, it's fine
        if (Date.now() < expiresAt - 30_000) return token;
    } catch {
        // Malformed token — try refresh anyway
    }

    // Token expired or about to — refresh it
    try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });
        if (!res.ok) return null;
        const data = await res.json();
        localStorage.setItem("accessToken", data.accessToken);
        return data.accessToken;
    } catch {
        return null;
    }
}

export function WebSocketProvider({
    children,
    accessToken,
}: {
    children: React.ReactNode;
    accessToken: string | null;
}) {
    const [client, setClient] = useState<Client | null>(null);

    useEffect(() => {
        if (!accessToken) return;

        let deactivated = false;

        const stompClient = new Client({
            brokerURL: `${WS_URL}/ws`,
            reconnectDelay: 5000,

            // Runs before EVERY connect attempt (initial + reconnects).
            // Always injects a fresh token so reconnects after long
            // inactivity use a valid JWT, not the stale original one.
            beforeConnect: async () => {
                const token = await getFreshToken();
                if (!token) {
                    // Refresh failed — force re-login
                    localStorage.removeItem("accessToken");
                    window.location.href = "/login";
                    return;
                }
                stompClient.connectHeaders = {
                    Authorization: `Bearer ${token}`,
                };
            },
        });

        stompClient.onConnect = () => {
            if (!deactivated) setClient(stompClient);
        };

        stompClient.onWebSocketClose = () => {
            if (!deactivated) setClient(null);
        };

        stompClient.activate();

        return () => {
            deactivated = true;
            stompClient.deactivate();
            setClient(null);
        };
    }, [accessToken]);

    return (
        <WebSocketContext.Provider value={client}>
            {children}
        </WebSocketContext.Provider>
    );
}
