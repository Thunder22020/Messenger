import { useState, useEffect, useRef, useCallback } from "react";
import type { AttachmentDto, ChatParticipant } from "./chatTypes";
import { authFetch } from "../../utils/authFetch";
import { API_URL } from "../../config";
import { formatFileSize, fileExtension, formatShortDate, formatMessageTime } from "./chatFormat";

type Tab = "members" | "media" | "files";

const PAGE_SIZE = 20;

// ---- MembersTab ----

function MembersTab({ participants, currentUsername, onUserClick }: {
  participants: ChatParticipant[];
  currentUsername: string | null;
  onUserClick: (id: number) => void;
}) {
  const sorted = [...participants].sort((a, b) => {
    if (a.username === currentUsername) return -1;
    if (b.username === currentUsername) return 1;
    return 0;
  });

  return (
    <div className="info-members-list">
      {sorted.map((user) => (
        <div key={user.id} className="info-member-row" onClick={() => onUserClick(user.id)}>
          <div className="info-avatar">{user.username.charAt(0).toUpperCase()}</div>
          <span className="info-member-name">{user.username}</span>
          {user.username === currentUsername && <span className="info-you-label">You</span>}
        </div>
      ))}
    </div>
  );
}

// ---- MediaTab ----

function MediaTab({ items, loading, hasMore, onLoadMore, onItemClick }: {
  items: AttachmentDto[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onItemClick: (index: number) => void;
}) {
  return (
    <div className="info-tab-section">
      {items.length === 0 && !loading && (
        <div className="info-panel-empty">No media yet</div>
      )}
      {items.length > 0 && (
        <div className="info-media-grid">
          {items.map((item, idx) => (
            <div key={item.id} className="info-media-item" onClick={() => onItemClick(idx)}>
              {item.type === "VIDEO" ? (
                <>
                  <video src={item.url} preload="metadata" muted />
                  <div className="info-media-play-icon" />
                </>
              ) : (
                <img src={item.url} alt={item.fileName} loading="lazy" />
              )}
            </div>
          ))}
        </div>
      )}
      {hasMore && !loading && (
        <button className="info-load-more-btn" onClick={onLoadMore}>Load more</button>
      )}
      {loading && <div className="info-panel-loading">Loading…</div>}
    </div>
  );
}

// ---- FilesTab ----

function FilesTab({ items, loading, hasMore, onLoadMore }: {
  items: AttachmentDto[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="info-tab-section">
      {items.length === 0 && !loading && (
        <div className="info-panel-empty">No files yet</div>
      )}
      <div className="info-files-list">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            download={item.fileName}
            className="info-file-row"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="file-attachment-icon">{fileExtension(item.fileName)}</div>
            <div className="info-file-info">
              <div className="info-file-name">{item.fileName}</div>
              <div className="info-file-meta">
                {formatFileSize(item.fileSize)}
                {item.createdAt && <> · {formatShortDate(item.createdAt)}</>}
              </div>
            </div>
            {item.createdAt && (
              <span className="info-file-time">{formatMessageTime(item.createdAt)}</span>
            )}
          </a>
        ))}
      </div>
      {hasMore && !loading && (
        <button className="info-load-more-btn" onClick={onLoadMore}>Load more</button>
      )}
      {loading && <div className="info-panel-loading">Loading…</div>}
    </div>
  );
}

// ---- ChatInfoPanel ----

export function ChatInfoPanel(props: {
  isOpen: boolean;
  chatName: string;
  chatType: string | null;
  chatId: number | null;
  participants: ChatParticipant[];
  currentUsername: string | null;
  onUserClick: (userId: number) => void;
  onMediaClick: (items: AttachmentDto[], index: number, meta: { sender: string; createdAt: string }) => void;
  onClose: () => void;
  onLeave?: () => void;
  isMobile?: boolean;
}) {
  const { isOpen, chatName, chatType, chatId, participants, currentUsername, onUserClick, onMediaClick, onClose, onLeave, isMobile } = props;

  const [activeTab, setActiveTab] = useState<Tab>(chatType === "GROUP" ? "members" : "media");

  const [media, setMedia] = useState<AttachmentDto[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaHasMore, setMediaHasMore] = useState(true);
  const mediaLoadingRef = useRef(false);
  const mediaFetchedRef = useRef(false);

  const [files, setFiles] = useState<AttachmentDto[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesHasMore, setFilesHasMore] = useState(true);
  const filesLoadingRef = useRef(false);
  const filesFetchedRef = useRef(false);

  // Reset all data when chat changes
  useEffect(() => {
    setActiveTab(chatType === "GROUP" ? "members" : "media");
    setMedia([]);
    setMediaHasMore(true);
    mediaLoadingRef.current = false;
    mediaFetchedRef.current = false;
    setFiles([]);
    setFilesHasMore(true);
    filesLoadingRef.current = false;
    filesFetchedRef.current = false;
  }, [chatId, chatType]);

  const loadMedia = useCallback(async (before?: number) => {
    if (!chatId || mediaLoadingRef.current) return;
    mediaLoadingRef.current = true;
    setMediaLoading(true);
    try {
      const url = before
        ? `${API_URL}/attachments/media?chatId=${chatId}&before=${before}`
        : `${API_URL}/attachments/media?chatId=${chatId}`;
      const res = await authFetch(url);
      if (!res || !res.ok) return;
      const data: AttachmentDto[] = await res.json();
      setMedia(prev => before ? [...prev, ...data] : data);
      setMediaHasMore(data.length === PAGE_SIZE);
    } finally {
      mediaLoadingRef.current = false;
      setMediaLoading(false);
    }
  }, [chatId]);

  const loadFiles = useCallback(async (before?: number) => {
    if (!chatId || filesLoadingRef.current) return;
    filesLoadingRef.current = true;
    setFilesLoading(true);
    try {
      const url = before
        ? `${API_URL}/attachments/files?chatId=${chatId}&before=${before}`
        : `${API_URL}/attachments/files?chatId=${chatId}`;
      const res = await authFetch(url);
      if (!res || !res.ok) return;
      const data: AttachmentDto[] = await res.json();
      setFiles(prev => before ? [...prev, ...data] : data);
      setFilesHasMore(data.length === PAGE_SIZE);
    } finally {
      filesLoadingRef.current = false;
      setFilesLoading(false);
    }
  }, [chatId]);

  // Lazy fetch: only on first activation of each tab while panel is open
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "media" && !mediaFetchedRef.current) {
      mediaFetchedRef.current = true;
      loadMedia();
    }
    if (activeTab === "files" && !filesFetchedRef.current) {
      filesFetchedRef.current = true;
      loadFiles();
    }
  }, [activeTab, isOpen, loadMedia, loadFiles]);

  const tabs: Tab[] = chatType === "GROUP" ? ["members", "media", "files"] : ["media", "files"];
  const tabLabels: Record<Tab, string> = { members: "Members", media: "Media", files: "Files" };

  return (
    <div className={`chat-info-panel ${isOpen ? "open" : ""}${isMobile && isOpen ? " info-panel-mobile" : ""}`}>
      <div className="info-chat-header">
        <span className="info-close-icon" onClick={onClose} />
        {chatType === "GROUP" && onLeave && (
          <span className="info-leave-icon" onClick={onLeave} title="Leave group" />
        )}
        <div className="info-chat-avatar">
          {chatName ? chatName.charAt(0).toUpperCase() : "?"}
        </div>
        <div className="info-chat-name">{chatName}</div>
      </div>

      <div className="info-tab-bar">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`info-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div className="info-tab-content">
        {activeTab === "members" && (
          <MembersTab
            participants={participants}
            currentUsername={currentUsername}
            onUserClick={onUserClick}
          />
        )}
        {activeTab === "media" && (
          <MediaTab
            items={media}
            loading={mediaLoading}
            hasMore={mediaHasMore}
            onLoadMore={() => {
              const last = media[media.length - 1];
              if (last) loadMedia(last.id);
            }}
            onItemClick={(index) => {
              const item = media[index];
              onMediaClick(media, index, {
                sender: item.senderUsername ?? chatName,
                createdAt: item.createdAt ?? new Date().toISOString(),
              });
            }}
          />
        )}
        {activeTab === "files" && (
          <FilesTab
            items={files}
            loading={filesLoading}
            hasMore={filesHasMore}
            onLoadMore={() => {
              const last = files[files.length - 1];
              if (last) loadFiles(last.id);
            }}
          />
        )}
      </div>
    </div>
  );
}
