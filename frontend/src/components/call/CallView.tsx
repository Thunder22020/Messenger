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
  const { activeCall, callStatus, endCall, remoteStream, localStream, videoEnabled, remoteVideoEnabled, toggleVideo } = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Always set srcObject immediately when streams change — refs are always attached
  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream ?? null;
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream ?? null;
  }, [localStream]);

  // Outgoing ring
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const muted = localStorage.getItem("muteSound") === "true";
    const shouldRing = callStatus === "ringing" && activeCall?.direction === "outgoing" && !muted;
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
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callStatus, activeCall?.startedAt]);

  if (!activeCall) return null;

  const isVideoCall = activeCall.video && callStatus === "active";

  // Case 1: both cameras on → remote main, local PiP
  // Case 2: one camera on → that one as main, no PiP of the other
  // Case 3: both off → audio fallback layout
  const showVideoLayout = isVideoCall && (videoEnabled || remoteVideoEnabled);

  // Which video goes in the main slot vs PiP
  // If remote is on: remote = main, local = PiP (only if our cam also on)
  // If remote is off but ours is on: local = main
  const remoteIsMain = remoteVideoEnabled;

  const initial = activeCall.peerUsername.charAt(0).toUpperCase();
  const statusText =
    callStatus === "ringing" ? "Ringing..."
    : callStatus === "connecting" ? "Connecting..."
    : callStatus === "active" ? formatDuration(elapsed)
    : "";

  const content = (
    <div className={`call-card${showVideoLayout ? " call-card--video" : ""}`}>
      <audio ref={audioRef} src="/sounds/outgoing-ring.mp3" loop />
      <audio ref={remoteAudioRef} autoPlay />

      {/* Always in DOM so refs stay bound to the same DOM nodes — only CSS class swaps */}
      {/* Remote video: main slot when remote cam on, PiP slot when remote cam off */}
      <video
        ref={remoteVideoRef}
        className={remoteIsMain ? "call-video-remote" : "call-video-local"}
        autoPlay
        playsInline
        style={{ display: showVideoLayout && remoteVideoEnabled ? "block" : "none" }}
      />
      {/* Local video: PiP when remote is main, main slot when remote cam off */}
      <video
        ref={localVideoRef}
        className={remoteIsMain ? "call-video-local" : "call-video-remote"}
        autoPlay
        playsInline
        muted
        style={{ display: showVideoLayout && videoEnabled ? "block" : "none" }}
      />

      {showVideoLayout ? (
        <div className="call-video-overlay">
          {layout === "modal" && (
            <button
              className="call-expand-btn"
              onClick={() => setIsExpanded((v) => !v)}
              title={isExpanded ? "Restore" : "Full screen"}
            >
              <img src="/icons/resize.png" alt="fullscreen" />
            </button>
          )}
          <p className="call-video-peer-name">{activeCall.peerUsername}</p>
          <p className="call-video-status-text">{statusText}</p>
          <div className="call-actions">
            <button
              className={`call-toggle-video-btn${videoEnabled ? "" : " off"}`}
              onClick={toggleVideo}
              title={videoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              <img src="/icons/cam-recorder.png" alt="camera" />
            </button>
            <button className="call-hangup-btn" onClick={endCall} title="Hang up">
              <img src="/icons/close.png" alt="Hang up" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="call-avatar">{initial}</div>
          <p className="call-peer-name">{activeCall.peerUsername}</p>
          <p className="call-status-text">{statusText}</p>
          <div className="call-actions">
            {isVideoCall && (
              <button
                className="call-toggle-video-btn off"
                onClick={toggleVideo}
                title="Turn on camera"
              >
                <img src="/icons/cam-recorder.png" alt="camera" />
              </button>
            )}
            <button className="call-hangup-btn" onClick={endCall} title="Hang up">
              <img src="/icons/close.png" alt="Hang up" />
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (layout === "modal") {
    return (
      <div className="call-overlay-backdrop">
        <div className={`call-modal-card${showVideoLayout ? " call-modal-card--video" : ""}${isExpanded ? " call-modal-card--expanded" : ""}`}>
          {content}
        </div>
      </div>
    );
  }

  return <div className="call-screen">{content}</div>;
}
