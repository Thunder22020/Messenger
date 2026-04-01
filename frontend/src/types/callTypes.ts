export interface CallEvent {
  callId: string;
  type: CallEventType;
  chatId: number;
  callerUsername: string;
  receiverUsername: string;
  durationSeconds?: number;
  video?: boolean;
}

export type CallEventType = "RINGING" | "ACCEPTED" | "REJECTED" | "ENDED" | "BUSY" | "CANCELLED";

export interface CallSignalMessage {
  callId: string;
  type: "OFFER" | "ANSWER" | "ICE_CANDIDATE" | "CAMERA_STATE";
  payload: string;
}

export interface ActiveCallState {
  callId: string;
  chatId: number;
  peerUsername: string;
  direction: "outgoing" | "incoming";
  startedAt: Date | null;
  video: boolean;
}

export type CallStatus = "idle" | "ringing" | "connecting" | "active" | "ended";
