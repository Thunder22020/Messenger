import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";
import { WS_URL } from "../config";
import { WebSocketContext } from "./WebSocketContext";

export function WebSocketProvider({
                                      children,
                                      accessToken
                                  }: {
    children: React.ReactNode
    accessToken: string | null
}) {
    const [client, setClient] = useState<Client | null>(null);

    useEffect(() => {
        if (!accessToken) return;

        // Guards against the cleanup callback's onWebSocketClose firing after
        // a new effect has already started (e.g. accessToken change).
        let deactivated = false;

        const stompClient = new Client({
            brokerURL: `${WS_URL}/ws`,
            reconnectDelay: 5000,
            connectHeaders: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        // Called on every successful connect AND every automatic reconnect.
        // Setting state here (null → object) is what triggers all subscriber
        // useEffect([client]) hooks to re-run and restore their subscriptions.
        stompClient.onConnect = () => {
            console.log("STOMP connected");
            setClient(stompClient);
        };

        // Called whenever the underlying WebSocket closes unexpectedly
        // (tab inactivity, network drop, server restart, etc.).
        // Setting client to null makes every subscriber effect clean up
        // immediately, so when the library reconnects and onConnect fires,
        // the null → object transition causes a full re-subscription.
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
