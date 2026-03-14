import type { Message } from "./chatTypes";

export function ReplyBar(props: {
  replyingTo: Message | null;
  onCancel: () => void;
}) {
  const { replyingTo, onCancel } = props;
  if (!replyingTo) return null;

  return (
    <div className="chat-reply-bar">
      <div className="chat-reply-bar-accent" />
      <div className="chat-edit-bar-content">
        <span className="chat-reply-bar-label">{replyingTo.sender}</span>
        <span className="chat-edit-bar-preview">
          {replyingTo.content ||
            (replyingTo.attachments?.length ? "📎 Photo" : "")}
        </span>
      </div>
      <button className="chat-edit-cancel-btn" onClick={onCancel}>
        ✕
      </button>
    </div>
  );
}

export function EditBar(props: {
  editingMessageId: number | null;
  originalContent: string;
  onCancel: () => void;
}) {
  const { editingMessageId, originalContent, onCancel } = props;
  if (editingMessageId === null) return null;

  return (
    <div className="chat-edit-bar">
      <div className="chat-edit-bar-accent" />
      <div className="chat-edit-bar-content">
        <span className="chat-edit-bar-label">Editing</span>
        <span className="chat-edit-bar-preview">{originalContent}</span>
      </div>
      <button className="chat-edit-cancel-btn" onClick={onCancel}>
        ✕
      </button>
    </div>
  );
}

