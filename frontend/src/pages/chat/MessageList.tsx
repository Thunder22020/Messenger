import type { RefObject } from "react";
import type { DateGroup, Message, UploadingBubble } from "./chatTypes";
import { formatMessageTime } from "./chatFormat";

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
                            className="message-bubble"
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

                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="message-attachments">
                                {msg.attachments.map((att) =>
                                  att.type === "PHOTO" ? (
                                    <img
                                      key={att.id}
                                      src={att.url}
                                      alt={att.fileName}
                                      className="message-image"
                                      onClick={() =>
                                        window.open(att.url, "_blank")
                                      }
                                    />
                                  ) : null
                                )}
                              </div>
                            )}

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

      {uploadingBubbles.map((bubble) => (
        <div key={bubble.tempId} className="message-group mine">
          <div className="message-row-collapse">
            <div className="message-row mine">
              <div className="message-bubble">
                {bubble.replyPreview && (
                  <div className="message-reply-preview">
                    <div className="reply-preview-sender">
                      {bubble.replyPreview.sender}
                    </div>
                    <div className="reply-preview-content">
                      {bubble.replyPreview.content || "Deleted message"}
                    </div>
                  </div>
                )}

                {bubble.files.length > 0 && (
                  <div className="message-attachments">
                    {bubble.files.map((pf) => (
                      <div key={pf.localId} className="uploading-image-wrapper">
                        <img
                          src={pf.previewUrl}
                          alt={pf.file.name}
                          className="message-image uploading"
                        />
                        <div className="upload-progress-overlay">
                          <svg
                            viewBox="0 0 36 36"
                            className="upload-progress-circle"
                          >
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              stroke="rgba(255,255,255,0.25)"
                              strokeWidth="3"
                            />
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              strokeDasharray={`${2 * Math.PI * 15}`}
                              strokeDashoffset={`${
                                2 * Math.PI * 15 * (1 - bubble.progress / 100)
                              }`}
                              strokeLinecap="round"
                              style={{
                                transform: "rotate(-90deg)",
                                transformOrigin: "50% 50%",
                                transition: "stroke-dashoffset 0.2s",
                              }}
                            />
                          </svg>
                          <span className="upload-progress-pct">
                            {bubble.progress}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="message-content">
                  <span className="message-text">{bubble.content}</span>
                  <span className="message-time">sending…</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

