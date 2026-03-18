import type { PendingFile } from "./chatTypes";
import { fileExtension } from "./chatFormat";

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
          {pf.isImage ? (
            <img
              src={pf.previewUrl}
              alt={pf.file.name}
              className="pending-attachment-thumb"
            />
          ) : (
            <div className="pending-attachment-file">
              <span className="pending-attachment-file-ext">{fileExtension(pf.file.name)}</span>
              <span className="pending-attachment-file-name">{pf.file.name}</span>
            </div>
          )}
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
