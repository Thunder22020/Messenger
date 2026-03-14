import type { RefObject } from "react";
import type { AttachmentDto, DateGroup, Message, PendingFile, UploadingBubble } from "./chatTypes";
import { formatMessageTime } from "./chatFormat";

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

function UploadingAttachmentGrid({ files, progress, hasTextBelow = false }: { files: PendingFile[]; progress: number; hasTextBelow?: boolean }) {
  const rows = distributeIntoRows(files, buildAttachmentRows(files.length));
  const totalRows = rows.length;
  const circumference = 2 * Math.PI * 15;
  return (
    <div className={`attachment-grid${files.length === 1 ? " single" : ""}`}>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="attachment-row">
          {row.map((pf, colIdx) => {
            const br = getImageBorderRadius(rowIdx, colIdx, totalRows, row.length, hasTextBelow);
            return (
              <div key={pf.localId} className="uploading-image-wrapper" style={{ borderRadius: br }}>
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
                    const hasMedia = photos.length > 0;
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
                                  {msg.replyPreview.content || "Deleted message"}
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
                                      <img src="/icons/edit.png" className="message-edited-icon" alt="edited" />
                                    )}
                                    <span className="message-time">{formattedTime}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {!isMediaOnly && (
                              <div className="message-content">
                                <span className="message-text">{msg.content}</span>
                                <span className="message-time">
                                  {msg.editedAt && (
                                    <img
                                      src="/icons/edit.png"
                                      className="message-edited-icon"
                                      alt="edited"
                                    />
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
        const hasMedia = bubble.files.length > 0;
        const isMediaOnly = hasMedia && !bubble.content;
        return (
          <div key={bubble.tempId} className="message-group mine">
            <div className="message-row-collapse">
              <div className="message-row mine">
                <div className={`message-bubble${isMediaOnly ? " media-only" : hasMedia ? " has-media" : ""}`}>
                  {bubble.replyPreview && (
                    <div className="message-reply-preview">
                      <div className="reply-preview-sender">{bubble.replyPreview.sender}</div>
                      <div className="reply-preview-content">
                        {bubble.replyPreview.content || "Deleted message"}
                      </div>
                    </div>
                  )}

                  {hasMedia && (
                    <div className="attachment-grid-wrapper">
                      <UploadingAttachmentGrid files={bubble.files} progress={bubble.progress} hasTextBelow={!isMediaOnly} />
                      {isMediaOnly && (
                        <div className="message-meta-overlay">
                          <span className="message-time">sending…</span>
                        </div>
                      )}
                    </div>
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

