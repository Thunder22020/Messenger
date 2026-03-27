export interface ReplyPreview {
  messageId: number;
  sender: string;
  content: string;
  attachmentType?: string | null;
}

export interface AttachmentDto {
  id: number;
  url: string;
  type: "PHOTO" | "VIDEO" | "AUDIO" | "FILE";
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt?: string;
  senderUsername?: string | null;
}

export interface PendingFile {
  localId: string;
  file: File;
  previewUrl: string;   // empty string for non-image files
  naturalWidth: number; // 0 for non-image files
  naturalHeight: number; // 0 for non-image files
  isImage: boolean;
}

export interface UploadingBubble {
  tempId: string;
  content: string;
  replyPreview?: ReplyPreview;
  files: PendingFile[];
  progress: number;
}

export interface Message {
  id: number;
  type?: string;
  content: string;
  sender: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyToMessageId?: number;
  replyPreview?: ReplyPreview;
  attachments?: AttachmentDto[];
}

export interface JwtPayload {
  sub: string;
  exp: number;
}

export interface ChatParticipant {
  id: number;
  username: string;
  lastReadMessageId: number | null;
}

export interface ReadAckEvent {
  chatId: number;
  readerUsername: string;
  lastReadMessageId: number;
}

export interface SenderGroup {
  sender: string;
  messages: Message[];
}

export interface DateGroup {
  dateKey: string;
  label: string;
  senderGroups: SenderGroup[];
}

