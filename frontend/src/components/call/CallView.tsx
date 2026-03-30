import { useEffect, useRef, useState } from "react";
import { useCall } from "../../context/CallContext";

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface CallViewProps {
  layout: "modal" | "screen";
}

export function CallView({ layout }: CallViewProps) {
  const { activeCall, callStatus, endCall, remoteStream } = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // Attach remote stream to audio element
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Outgoing ring
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const muted = localStorage.getItem("muteSound") === "true";
    const shouldRing =
      callStatus === "ringing" &&
      activeCall?.direction === "outgoing" &&
      !muted;
    if (shouldRing) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [callStatus, activeCall?.direction]);

  // Duration timer
  useEffect(() => {
    if (callStatus !== "active" || !activeCall?.startedAt) {
      setElapsed(0);
      return;
    }
    const startedAt = activeCall.startedAt;
    const tick = () => {
      const diff = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      setElapsed(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callStatus, activeCall?.startedAt]);

  if (!activeCall) return null;

  const initial = activeCall.peerUsername.charAt(0).toUpperCase();

  const statusText =
    callStatus === "ringing"
      ? "Ringing..."
      : callStatus === "connecting"
      ? "Connecting..."
      : callStatus === "active"
      ? formatDuration(elapsed)
      : "";

  const content = (
    <div className="call-card">
      <audio ref={audioRef} src="/sounds/outgoing-ring.mp3" loop />
      <audio ref={remoteAudioRef} autoPlay />
      <div className="call-avatar">{initial}</div>
      <p className="call-peer-name">{activeCall.peerUsername}</p>
      <p className="call-status-text">{statusText}</p>
      <div className="call-actions">
        <button className="call-hangup-btn" onClick={endCall} title="Hang up">
          ✕
        </button>
      </div>
    </div>
  );

  if (layout === "modal") {
    return (
      <div className="call-overlay-backdrop">
        <div className="call-modal-card">{content}</div>
      </div>
    );
  }

  return <div className="call-screen">{content}</div>;
}
