export interface CallEvent {
  callId: string;
  type: CallEventType;
  chatId: number;
  callerUsername: string;
  receiverUsername: string;
  durationSeconds?: number;
}

export type CallEventType = "RINGING" | "ACCEPTED" | "REJECTED" | "ENDED" | "BUSY" | "CANCELLED";

export interface CallSignalMessage {
  callId: string;
  type: "OFFER" | "ANSWER" | "ICE_CANDIDATE";
  payload: string;
}

export interface ActiveCallState {
  callId: string;
  chatId: number;
  peerUsername: string;
  direction: "outgoing" | "incoming";
  startedAt: Date | null;
}

export type CallStatus = "idle" | "ringing" | "connecting" | "active" | "ended";
