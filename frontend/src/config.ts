export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// In docker (VITE_API_URL=""), derive WS URL from the current page origin
// so it automatically uses ws:// or wss:// depending on HTTP vs HTTPS.
// In local dev, falls back to localhost.
const defaultWsUrl = API_URL === ""
  ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
  : "ws://localhost:8080";

export const WS_URL = import.meta.env.VITE_WS_URL ?? defaultWsUrl;
