import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useWebSocket } from "./WebSocketContext";
import { useWebRTC } from "../hooks/useWebRTC";
import { authFetch } from "../utils/authFetch";
import { API_URL } from "../config";
import type {
  CallEvent,
  CallSignalMessage,
  ActiveCallState,
  CallStatus,
} from "../types/callTypes";

interface CallContextValue {
  incomingCall: CallEvent | null;
  activeCall: ActiveCallState | null;
  callStatus: CallStatus;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  videoEnabled: boolean;
  remoteVideoEnabled: boolean;
  toggleVideo: () => void;
  initiateCall: (chatId: number, peerUsername: string, video?: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextValue>({
  incomingCall: null,
  activeCall: null,
  callStatus: "idle",
  remoteStream: null,
  localStream: null,
  videoEnabled: false,
  remoteVideoEnabled: true,
  toggleVideo: () => {},
  initiateCall: async () => {},
  acceptCall: async () => {},
  rejectCall: () => {},
  endCall: () => {},
});

export function CallProvider({ children }: { children: React.ReactNode }) {
  const client = useWebSocket();

  const [incomingCall, setIncomingCall] = useState<CallEvent | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);

  // Ref mirrors so STOMP handlers always read latest values without stale closures
  const activeCallRef = useRef<ActiveCallState | null>(null);
  const incomingCallRef = useRef<CallEvent | null>(null);
  const callStatusRef = useRef<CallStatus>("idle");

  // Fix 1: callIdRef kept in sync with activeCall.callId, passed to useWebRTC
  const callIdRef = useRef<string | null>(null);
  const videoRef = useRef<boolean>(false);

  // Fix 6: wrap syncActiveCall in useCallback
  const syncActiveCall = useCallback((call: ActiveCallState | null) => {
    activeCallRef.current = call;
    callIdRef.current = call?.callId ?? null; // Fix 1: keep callIdRef in sync
    setActiveCall(call);
  }, []);

  // Keep callStatusRef in sync so connectionState effect can read latest status without deps
  const syncCallStatus = useCallback((status: CallStatus) => {
    callStatusRef.current = status;
    setCallStatus(status);
  }, []);

  // Keep incomingCallRef in sync
  const syncIncomingCall = useCallback((call: CallEvent | null) => {
    incomingCallRef.current = call;
    setIncomingCall(call);
  }, []);

  // Sync ref updated every render — avoids stale closure when STOMP reconnects
  // between setClient(stompClient) being scheduled and effects flushing
  const clientRef = useRef(client);
  clientRef.current = client;

  const onSignal = useCallback((msg: CallSignalMessage) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({ destination: "/app/call.signal", body: JSON.stringify(msg) });
  }, []);

  const webRTC = useWebRTC({
    onSignal,
    callIdRef,
    videoRef,
  });

  // Stable refs for webRTC functions to avoid STOMP resubscribe on connectionState change
  const startAsOfferRef = useRef(webRTC.startAsOffer);
  const handleOfferRef = useRef(webRTC.handleOffer);
  const handleAnswerRef = useRef(webRTC.handleAnswer);
  const handleIceCandidateRef = useRef(webRTC.handleIceCandidate);
  const cleanupRef = useRef(webRTC.cleanup);

  useEffect(() => {
    startAsOfferRef.current = webRTC.startAsOffer;
    handleOfferRef.current = webRTC.handleOffer;
    handleAnswerRef.current = webRTC.handleAnswer;
    handleIceCandidateRef.current = webRTC.handleIceCandidate;
    cleanupRef.current = webRTC.cleanup;
  }, [webRTC.startAsOffer, webRTC.handleOffer, webRTC.handleAnswer, webRTC.handleIceCandidate, webRTC.cleanup]);

  // Stable ref for endCall — populated after endCall is defined below
  const endCallRef = useRef<() => void>(() => {});

  // Fix 4: no webRTC in deps — use only stable refs
  const handleCallEvent = useCallback((event: CallEvent) => {
    switch (event.type) {
      case "RINGING":
        syncIncomingCall(event);
        syncCallStatus("ringing");
        break;

      case "ACCEPTED": {
        if (activeCallRef.current?.direction === "outgoing") {
          // We're the CALLER — proceed with offer
          syncCallStatus("connecting");
          syncActiveCall({ ...activeCallRef.current, startedAt: new Date() });
          startAsOfferRef.current();
        } else if (incomingCallRef.current) {
          // We're the RECEIVER on another tab — dismiss incoming call UI
          syncIncomingCall(null);
          syncCallStatus("idle");
        }
        break;
      }

      case "REJECTED":
      case "CANCELLED":
        syncIncomingCall(null);
        syncActiveCall(null);
        syncCallStatus("idle");
        setRemoteVideoEnabled(true);
        cleanupRef.current();
        break;

      case "ENDED":
        syncIncomingCall(null);
        syncActiveCall(null);
        syncCallStatus("idle");
        setRemoteVideoEnabled(true);
        cleanupRef.current();
        break;

      case "BUSY":
        syncIncomingCall(null);
        syncActiveCall(null);
        syncCallStatus("idle");
        break;
    }
  }, [syncActiveCall, syncCallStatus, syncIncomingCall]);

  // Fix 4: no webRTC in deps — use only stable refs
  const handleSignalMessage = useCallback((msg: CallSignalMessage) => {
    switch (msg.type) {
      case "OFFER":
        handleOfferRef.current(msg.payload);
        break;
      case "ANSWER":
        handleAnswerRef.current(msg.payload);
        break;
      case "ICE_CANDIDATE":
        handleIceCandidateRef.current(msg.payload);
        break;
      case "CAMERA_STATE":
        setRemoteVideoEnabled(msg.payload === "on");
        break;
    }
  }, []);

  useEffect(() => {
    if (!client) return;

    const callSub = client.subscribe("/user/queue/call", (frame) => {
      const event: CallEvent = JSON.parse(frame.body);
      handleCallEvent(event);
    });

    const signalSub = client.subscribe("/user/queue/call.signal", (frame) => {
      const msg: CallSignalMessage = JSON.parse(frame.body);
      handleSignalMessage(msg);
    });

    return () => {
      callSub.unsubscribe();
      signalSub.unsubscribe();
    };
  }, [client, handleCallEvent, handleSignalMessage]);

  const initiateCall = useCallback(async (chatId: number, peerUsername: string, video = false): Promise<void> => {
    videoRef.current = video;
    const res = await authFetch(`${API_URL}/call/initiate`, {
      method: "POST",
      body: JSON.stringify({ chatId, video }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res) return;
    const { callId } = await res.json();
    const call: ActiveCallState = {
      callId,
      chatId,
      peerUsername,
      direction: "outgoing",
      startedAt: null,
      video,
    };
    syncActiveCall(call);
    syncCallStatus("ringing");
  }, [syncActiveCall, syncCallStatus, videoRef]);

  const acceptCall = useCallback(async (): Promise<void> => {
    const call = incomingCall;
    if (!call) return;

    videoRef.current = call.video ?? false;
    await authFetch(`${API_URL}/call/${call.callId}/accept`, { method: "POST" });

    syncActiveCall({
      callId: call.callId,
      chatId: call.chatId,
      peerUsername: call.callerUsername,
      direction: "incoming",
      startedAt: null,
      video: call.video ?? false,
    });
    syncIncomingCall(null);
    syncCallStatus("connecting");
  }, [incomingCall, syncActiveCall, syncCallStatus, syncIncomingCall, videoRef]);

  // Fix 8: add .catch(console.error) to authFetch calls
  const rejectCall = useCallback((): void => {
    if (!incomingCall) return;
    authFetch(`${API_URL}/call/${incomingCall.callId}/reject`, { method: "POST" }).catch(console.error);
    syncIncomingCall(null);
    syncCallStatus("idle");
  }, [incomingCall, syncCallStatus, syncIncomingCall]);

  // Fix 8: add .catch(console.error) to authFetch calls
  // Use activeCallRef so endCall is stable (no activeCall dep) — safe to call from connectionState effect
  const endCall = useCallback((): void => {
    if (!activeCallRef.current) return;
    authFetch(`${API_URL}/call/${activeCallRef.current.callId}/end`, { method: "POST" }).catch(console.error);
    cleanupRef.current();
    syncActiveCall(null);
    syncIncomingCall(null);
    syncCallStatus("idle");
  }, [syncActiveCall, syncIncomingCall, syncCallStatus]);

  // Keep endCallRef in sync so the connectionState effect below always calls the latest version
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Timeout: if still "connecting" after 30s, end the call
  useEffect(() => {
    if (callStatus !== "connecting") return;
    const id = setTimeout(() => endCallRef.current(), 30_000);
    return () => clearTimeout(id);
  }, [callStatus]);

  // Set callStatus to "active" when WebRTC connection is established.
  // Reads callStatusRef to avoid stale closure; calls endCallRef to avoid circular dep.
  useEffect(() => {
    if (webRTC.connectionState === "connected" && callStatusRef.current === "connecting") {
      syncCallStatus("active");
      syncActiveCall(activeCallRef.current ? {
        ...activeCallRef.current,
        startedAt: new Date(),
      } : null);
    }
    if (webRTC.connectionState === "failed") {
      endCallRef.current();
    }
    if (webRTC.connectionState === "disconnected" && callStatusRef.current === "active") {
      syncCallStatus("connecting"); // visual "Reconnecting..." feedback
    }
  }, [webRTC.connectionState, syncActiveCall, syncCallStatus]);

  return (
    <CallContext.Provider
      value={{
        incomingCall,
        activeCall,
        callStatus,
        remoteStream: webRTC.remoteStream,
        localStream: webRTC.localStream,
        videoEnabled: webRTC.videoEnabled,
        remoteVideoEnabled,
        toggleVideo: webRTC.toggleVideo,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
