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

        const stompClient = new Client({
            brokerURL: `${WS_URL}/ws`,
            reconnectDelay: 5000,
            connectHeaders: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        stompClient.onConnect = () => {
            console.log("STOMP connected as new user");
            setClient(stompClient);
        };

        stompClient.activate();

        return () => {
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
