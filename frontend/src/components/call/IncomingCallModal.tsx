import { useEffect, useRef } from "react";
import { useCall } from "../../context/CallContext";

export function IncomingCallModal() {
  const { incomingCall, acceptCall, rejectCall } = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const muted = localStorage.getItem("muteSound") === "true";
    if (incomingCall && !muted) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const initial = incomingCall.callerUsername.charAt(0).toUpperCase();

  return (
    <div className="call-overlay-backdrop">
      <audio ref={audioRef} src="/sounds/incoming-ring.mp3" loop />
      <div className="incoming-call-modal">
        <p className="call-label">Incoming call</p>
        <div className="call-avatar">{initial}</div>
        <p className="call-peer-name">{incomingCall.callerUsername}</p>
        <div className="call-actions">
          <button className="call-decline-btn" onClick={rejectCall} title="Decline">
            <img src="/icons/close.png" alt="Decline" />
          </button>
          <button className="call-accept-btn" onClick={acceptCall} title="Accept">
            <img src="/icons/check.png" alt="Accept" />
          </button>
        </div>
      </div>
    </div>
  );
}
