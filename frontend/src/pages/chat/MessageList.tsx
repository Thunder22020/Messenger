import type { RefObject } from "react";
import type { AttachmentDto, DateGroup, Message, PendingFile, UploadingBubble } from "./chatTypes";
import { formatMessageTime, formatFileSize, fileExtension } from "./chatFormat";

const IMAGE_CORNER_R = 13; // bubble outer radius (16) minus bubble padding (3)

function getImageBorderRadius(
  rowIdx: number,
  colIdx: number,
  totalRows: number,
  rowSize: number,
  hasTextBelow: boolean
): string {
  const r = IMAGE_CORNER_R;
  const tl = rowIdx === 0 && colIdx === 0 ? r : 0;
  const tr = rowIdx === 0 && colIdx === rowSize - 1 ? r : 0;
  const br = rowIdx === totalRows - 1 && colIdx === rowSize - 1 && !hasTextBelow ? r : 0;
  const bl = rowIdx === totalRows - 1 && colIdx === 0 && !hasTextBelow ? r : 0;
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) return "0";
  return `${tl}px ${tr}px ${br}px ${bl}px`;
}

function buildAttachmentRows(count: number): number[] {
  if (count === 1) return [1];
  if (count === 2) return [2];
  if (count === 3) return [1, 2];
  if (count === 4) return [2, 2];
  return [2, 3];
}

function distributeIntoRows<T>(items: T[], rowSizes: number[]): T[][] {
  const rows: T[][] = [];
  let i = 0;
  for (const size of rowSizes) {
    rows.push(items.slice(i, i + size));
    i += size;
  }
  return rows;
}

function AttachmentGrid({ photos, onImageClick, hasTextBelow = false }: { photos: AttachmentDto[]; onImageClick: (index: number) => void; hasTextBelow?: boolean }) {
  const rows = distributeIntoRows(photos, buildAttachmentRows(photos.length));
  const totalRows = rows.length;
  return (
    <div className={`attachment-grid${photos.length === 1 ? " single" : ""}`}>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="attachment-row">
          {row.map((att, colIdx) => (
            <img
              key={att.id}
              src={att.url}
              alt={att.fileName}
              className="message-image"
              style={{ borderRadius: getImageBorderRadius(rowIdx, colIdx, totalRows, row.length, hasTextBelow) }}
              onClick={() => onImageClick(photos.indexOf(att))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const MAX_SINGLE_W = 280;
const MAX_SINGLE_H = 320;

function singleImageSize(nw: number, nh: number): { width: number; height: number } {
  const scale = Math.min(MAX_SINGLE_W / nw, MAX_SINGLE_H / nh, 1);
  return { width: Math.round(nw * scale), height: Math.round(nh * scale) };
}

function FileAttachmentList({ files }: { files: AttachmentDto[] }) {
  return (
    <div className="file-attachment-list">
      {files.map((f) => (
        <a
          key={f.id}
          href={f.url}
          download={f.fileName}
          className="file-attachment-card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="file-attachment-icon">{fileExtension(f.fileName)}</div>
          <div className="file-attachment-info">
            <div className="file-attachment-name">{f.fileName}</div>
            <div className="file-attachment-meta">{formatFileSize(f.fileSize)}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

function UploadingAttachmentGrid({ files, progress, hasTextBelow = false }: { files: PendingFile[]; progress: number; hasTextBelow?: boolean }) {
  const isSingle = files.length === 1;
  const rows = distributeIntoRows(files, buildAttachmentRows(files.length));
  const totalRows = rows.length;
  const circumference = 2 * Math.PI * 15;
  return (
    <div className={`attachment-grid${isSingle ? " single" : ""}`}>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="attachment-row">
          {row.map((pf, colIdx) => {
            const br = getImageBorderRadius(rowIdx, colIdx, totalRows, row.length, hasTextBelow);
            const wrapperStyle = isSingle
              ? { borderRadius: br, ...singleImageSize(pf.naturalWidth, pf.naturalHeight) }
              : { borderRadius: br };
            return (
              <div key={pf.localId} className="uploading-image-wrapper" style={wrapperStyle}>
                <img src={pf.previewUrl} alt={pf.file.name} className="message-image uploading" style={{ borderRadius: br }} />
                <div className="upload-progress-overlay">
                  <svg viewBox="0 0 36 36" className="upload-progress-circle">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15" fill="none" stroke="white" strokeWidth="3"
                      strokeDasharray={`${circumference}`}
                      strokeDashoffset={`${circumference * (1 - progress / 100)}`}
                      strokeLinecap="round"
                      style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.2s" }}
                    />
                  </svg>
                  <span className="upload-progress-pct">{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function UploadingFileList({ files, progress }: { files: PendingFile[]; progress: number }) {
  return (
    <div className="file-attachment-list uploading-file-list">
      {files.map((pf) => (
        <div key={pf.localId} className="file-attachment-card uploading-file-card">
          <div className="file-attachment-icon">{fileExtension(pf.file.name)}</div>
          <div className="file-attachment-info">
            <div className="file-attachment-name">{pf.file.name}</div>
            <div className="file-attachment-meta uploading-file-progress">
              <span className="uploading-file-bar-wrap">
                <span className="uploading-file-bar" style={{ width: `${progress}%` }} />
              </span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageList(props: {
  dateGroups: DateGroup[];
  uploadingBubbles: UploadingBubble[];
  chatType: string | null;
  currentUsername: string | null;
  unreadDividerMessageId: number | null | undefined;
  dividerRef: RefObject<HTMLDivElement | null>;
  deletingMessageIds: Set<number>;
  isReadByAnyOther: (messageId: number) => boolean;
  onMessageContextMenu: (e: React.MouseEvent, msg: Message, isMine: boolean) => void;
  onScrollToMessage: (messageId: number) => void;
  onImageClick: (photos: AttachmentDto[], index: number, meta: { sender: string; createdAt: string }) => void;
}) {
  const {
    dateGroups,
    uploadingBubbles,
    chatType,
    currentUsername,
    unreadDividerMessageId,
    dividerRef,
    deletingMessageIds,
    isReadByAnyOther,
    onMessageContextMenu,
    onScrollToMessage,
    onImageClick,
  } = props;

  return (
    <div className="messages-column">
      {dateGroups.map((dateGroup) => (
        <div key={dateGroup.dateKey} className="date-section">
          <div className="date-separator">
            <span className="date-pill">{dateGroup.label}</span>
          </div>

          {dateGroup.senderGroups.map((group) => {
            const isMine = group.sender === currentUsername;
            const showGroupDivider =
              unreadDividerMessageId != null &&
              group.messages.some((m) => m.id === unreadDividerMessageId);

            return (
              <div key={group.messages[0].id}>
                {showGroupDivider && (
                  <div ref={dividerRef} className="unread-messages-divider">
                    <span className="unread-messages-divider-label">Unread messages</span>
                  </div>
                )}

                <div className={`message-group ${isMine ? "mine" : "other"}`}>
                  {!isMine && chatType === "GROUP" && (
                    <div className="group-sender-label">{group.sender}</div>
                  )}

                  {group.messages.map((msg, msgIdx) => {
                    const isLast = msgIdx === group.messages.length - 1;
                    const formattedTime = formatMessageTime(msg.createdAt);
                    const showUnreadDot = isMine && !isReadByAnyOther(msg.id);
                    const photos = msg.attachments?.filter(a => a.type === "PHOTO") ?? [];
                    const fileDtos = msg.attachments?.filter(a => a.type === "FILE") ?? [];
                    const hasMedia = photos.length > 0;
                    const hasFiles = fileDtos.length > 0;
                    const isMediaOnly = hasMedia && !msg.content;

                    return (
                      <div
                        key={msg.id}
                        data-message-id={msg.id}
                        className={`message-row-collapse${
                          deletingMessageIds.has(msg.id) ? " collapsing" : ""
                        }`}
                      >
                        <div className={`message-row ${isMine ? "mine" : "other"}`}>
                          {!isMine && chatType === "GROUP" && (
                            isLast ? (
                              <div className="message-avatar">
                                {group.sender.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <div className="message-avatar-spacer" />
                            )
                          )}

                          {isMine && (
                            <div
                              className={`unread-dot${
                                showUnreadDot ? " visible" : ""
                              }`}
                            />
                          )}

                          <div
                            className={`message-bubble${isMediaOnly ? " media-only" : hasMedia ? " has-media" : ""}`}
                            onContextMenu={(e) =>
                              onMessageContextMenu(e, msg, isMine)
                            }
                          >
                            {msg.replyPreview && (
                              <div
                                className="message-reply-preview"
                                onClick={() =>
                                  onScrollToMessage(msg.replyPreview!.messageId)
                                }
                              >
                                <div className="reply-preview-sender">
                                  {msg.replyPreview.sender}
                                </div>
                                <div className="reply-preview-content">
                                  {msg.replyPreview.content ||
                                    (msg.replyPreview.attachmentType === "PHOTO" ? "📎 Photo" :
                                     msg.replyPreview.attachmentType === "FILE" ? "📎 File" :
                                     "Deleted message")}
                                </div>
                              </div>
                            )}

                            {hasMedia && (
                              <div className="attachment-grid-wrapper">
                                <AttachmentGrid
                                  photos={photos}
                                  onImageClick={(i) => onImageClick(photos, i, { sender: msg.sender, createdAt: msg.createdAt })}
                                  hasTextBelow={!isMediaOnly}
                                />
                                {isMediaOnly && (
                                  <div className="message-meta-overlay">
                                    {msg.editedAt && (
                                      <span className="message-edited-icon" role="img" aria-label="edited" />
                                    )}
                                    <span className="message-time">{formattedTime}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {hasFiles && (
                              <FileAttachmentList files={fileDtos} />
                            )}

                            {!isMediaOnly && (
                              <div className="message-content">
                                <span className="message-text">{msg.content}</span>
                                <span className="message-time">
                                  {msg.editedAt && (
                                    <span className="message-edited-icon" role="img" aria-label="edited" />
                                  )}
                                  {formattedTime}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {uploadingBubbles.map((bubble) => {
        const hasImages = bubble.files.some(f => f.isImage);
        const hasFiles = bubble.files.length > 0 && !hasImages;
        const isMediaOnly = hasImages && !bubble.content;
        return (
          <div key={bubble.tempId} className="message-group mine">
            <div className="message-row-collapse">
              <div className="message-row mine">
                <div className={`message-bubble${isMediaOnly ? " media-only" : hasImages ? " has-media" : ""}`}>
                  {bubble.replyPreview && (
                    <div className="message-reply-preview">
                      <div className="reply-preview-sender">{bubble.replyPreview.sender}</div>
                      <div className="reply-preview-content">
                        {bubble.replyPreview.content || "Deleted message"}
                      </div>
                    </div>
                  )}

                  {hasImages && (
                    <div className="attachment-grid-wrapper">
                      <UploadingAttachmentGrid files={bubble.files} progress={bubble.progress} hasTextBelow={!isMediaOnly} />
                      {isMediaOnly && (
                        <div className="message-meta-overlay">
                          <span className="message-time">sending…</span>
                        </div>
                      )}
                    </div>
                  )}

                  {hasFiles && (
                    <UploadingFileList files={bubble.files} progress={bubble.progress} />
                  )}

                  {!isMediaOnly && (
                    <div className="message-content">
                      <span className="message-text">{bubble.content}</span>
                      <span className="message-time">sending…</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
