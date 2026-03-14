import type { PendingFile } from "./chatTypes";

export function AttachmentsBar(props: {
  pendingFiles: PendingFile[];
  onRemove: (localId: string) => void;
}) {
  const { pendingFiles, onRemove } = props;

  if (pendingFiles.length === 0) return null;

  return (
    <div className="chat-attachments-bar">
      {pendingFiles.map((pf) => (
        <div key={pf.localId} className="pending-attachment">
          <img
            src={pf.previewUrl}
            alt={pf.file.name}
            className="pending-attachment-thumb"
          />
          <button
            className="pending-attachment-remove"
            onClick={() => onRemove(pf.localId)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

