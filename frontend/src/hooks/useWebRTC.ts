import { useRef, useState, useCallback } from "react";
import type { CallSignalMessage } from "../types/callTypes";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

interface UseWebRTCOptions {
  onSignal: (msg: CallSignalMessage) => void;
  callIdRef: React.MutableRefObject<string | null>; // Fix 1: use ref instead of plain prop
  constraints?: MediaStreamConstraints;
}

interface UseWebRTCReturn {
  startAsOffer: () => Promise<void>;
  handleOffer: (sdp: string) => Promise<void>;
  handleAnswer: (sdp: string) => Promise<void>;
  handleIceCandidate: (candidateJson: string) => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCIceConnectionState;
  cleanup: () => void;
}

export function useWebRTC({
  onSignal,
  callIdRef, // Fix 1
  constraints = { audio: true, video: false },
}: UseWebRTCOptions): UseWebRTCReturn {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Fix 5: ICE candidate buffer for candidates arriving before setRemoteDescription
  const iceCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCIceConnectionState>("new");

  const createPeerConnection = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      // Fix 1: read callIdRef.current at signal-send time, never stale
      const currentCallId = callIdRef.current;
      if (event.candidate && currentCallId) {
        onSignal({
          callId: currentCallId,
          type: "ICE_CANDIDATE",
          payload: JSON.stringify(event.candidate),
        });
      }
    };

    // Fix 3: create new MediaStream from the event directly so React detects the change
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.oniceconnectionstatechange = () => {
      setConnectionState(pc.iceConnectionState);
    };

    return pc;
  }, [callIdRef, onSignal]);

  const startAsOffer = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Fix 1: read callIdRef.current at signal-send time
    const currentCallId = callIdRef.current;
    if (currentCallId) {
      onSignal({
        callId: currentCallId,
        type: "OFFER",
        payload: offer.sdp ?? "",
      });
    }
  }, [callIdRef, constraints, createPeerConnection, onSignal]);

  const handleOffer = useCallback(async (sdp: string): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));

    // Fix 5: mark remote desc as set and flush buffered ICE candidates
    remoteDescSetRef.current = true;
    for (const c of iceCandidateBufferRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    }
    iceCandidateBufferRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Fix 1: read callIdRef.current at signal-send time
    const currentCallId = callIdRef.current;
    if (currentCallId) {
      onSignal({
        callId: currentCallId,
        type: "ANSWER",
        payload: answer.sdp ?? "",
      });
    }
  }, [callIdRef, constraints, createPeerConnection, onSignal]);

  const handleAnswer = useCallback(async (sdp: string): Promise<void> => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
    remoteDescSetRef.current = true;
    for (const c of iceCandidateBufferRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    }
    iceCandidateBufferRef.current = [];
  }, []);

  const handleIceCandidate = useCallback(async (candidateJson: string): Promise<void> => {
    const candidate = JSON.parse(candidateJson);
    const pc = peerConnectionRef.current;
    if (!pc) return;
    // Fix 5: buffer candidates if remote description not yet set
    if (!remoteDescSetRef.current) {
      iceCandidateBufferRef.current.push(candidate);
      return;
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const cleanup = useCallback((): void => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    // Fix 5: reset buffer refs on cleanup
    iceCandidateBufferRef.current = [];
    remoteDescSetRef.current = false;

    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("new");
  }, []);

  return {
    startAsOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    localStream,
    remoteStream,
    connectionState,
    cleanup,
  };
}
