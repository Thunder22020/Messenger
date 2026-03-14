import { createContext, useContext } from "react";
import type { Client } from "@stomp/stompjs";

export const WebSocketContext = createContext<Client | null>(null);

export function useWebSocket() {
  return useContext(WebSocketContext);
}

