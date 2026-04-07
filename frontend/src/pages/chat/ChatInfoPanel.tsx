import { useState, useEffect, useRef, useCallback } from "react";
import type { AttachmentDto, ChatParticipant } from "./chatTypes";
import { authFetch } from "../../utils/authFetch";
import { API_URL } from "../../config";
import { formatFileSize, fileExtension, formatShortDate } from "./chatFormat";
import { useLanguage } from "../../context/LanguageContext";

type Tab = "members" | "media" | "files";

const PAGE_SIZE = 20;

type SearchUser = { id: number; username: string };

// ---- MembersTab ----

function MembersTab({ participants, currentUsername, onUserClick, chatId, addMode, onEnterAddMode }: {
  participants: ChatParticipant[];
  currentUsername: string | null;
  onUserClick: (id: number) => void;
  chatId: number | null;
  addMode: boolean;
  onEnterAddMode: () => void;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const existingIds = new Set(participants.map(p => p.id));

  useEffect(() => {
    if (!addMode) {
      setQuery("");
      setSearchResults([]);
      setSelected([]);
    }
  }, [addMode]);

  useEffect(() => {
    if (!addMode) return;
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await authFetch(`${API_URL}/users/search?query=${query}`);
      if (!res || !res.ok) return;
      const data: SearchUser[] = await res.json();
      setSearchResults(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, addMode]);

  const toggleSelect = (user: SearchUser) => {
    setSelected(prev =>
      prev.some(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleConfirm = async () => {
    if (!chatId || selected.length === 0 || submitting) return;
    setSubmitting(true);
    await authFetch(`${API_URL}/chat/${chatId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: selected.map(u => u.id) }),
    });
    setSubmitting(false);
    onEnterAddMode(); // toggles addMode off in parent
  };

  if (addMode) {
    const selectedIds = new Set(selected.map(u => u.id));
    const filteredResults = searchResults.filter(
      u => !selectedIds.has(u.id) && !existingIds.has(u.id)
    );

    return (
      <div className="info-members-list">
        <div className="info-add-search-row">
          <input
            className="info-add-search-input"
            placeholder={t("info.searchUsers")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {selected.length > 0 ? (
            <button className="info-add-action-btn" onClick={handleConfirm} disabled={submitting}>
              <img src="/icons/check.png" alt="confirm" className="info-add-action-icon confirm" />
            </button>
          ) : (
            <button className="info-add-action-btn" onClick={onEnterAddMode}>
              <img src="/icons/close.png" alt="cancel" className="info-add-action-icon cancel" />
            </button>
          )}
        </div>

        {selected.map(user => (
          <div key={user.id} className="info-member-row info-add-user-row" onClick={() => toggleSelect(user)}>
            <div className="info-add-checkbox checked">
              <div className="info-add-checkbox-dot" />
            </div>
            <div className="info-avatar">{user.username.charAt(0).toUpperCase()}</div>
            <span className="info-member-name">{user.username}</span>
          </div>
        ))}

        {filteredResults.map(user => {
          const isMember = existingIds.has(user.id);
          return (
            <div
              key={user.id}
              className={`info-member-row info-add-user-row${isMember ? " disabled" : ""}`}
              onClick={() => !isMember && toggleSelect(user)}
            >
              <div className={`info-add-checkbox${isMember ? " checked disabled" : ""}`}>
                {isMember && <div className="info-add-checkbox-dot" />}
              </div>
              <div className="info-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <span className="info-member-name">{user.username}</span>
            </div>
          );
        })}

        {searchResults.filter(u => existingIds.has(u.id)).map(user => (
          <div key={user.id} className="info-member-row info-add-user-row disabled">
            <div className="info-add-checkbox checked disabled">
              <div className="info-add-checkbox-dot" />
            </div>
            <div className="info-avatar">{user.username.charAt(0).toUpperCase()}</div>
            <span className="info-member-name">{user.username}</span>
            <span className="info-you-label">{t("info.member")}</span>
          </div>
        ))}

        {query.trim() && searchResults.length === 0 && (
          <div className="info-panel-empty">{t("info.noUsers")}</div>
        )}
      </div>
    );
  }

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
          {user.username === currentUsername && <span className="info-you-label">{t("info.you")}</span>}
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
  const { t } = useLanguage();
  return (
    <div className="info-tab-section">
      {items.length === 0 && !loading && (
        <div className="info-panel-empty">{t("info.noMedia")}</div>
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
        <button className="info-load-more-btn" onClick={onLoadMore}>{t("info.loadMore")}</button>
      )}
      {loading && <div className="info-panel-loading">{t("info.loading")}</div>}
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
  const { t } = useLanguage();
  return (
    <div className="info-tab-section">
      {items.length === 0 && !loading && (
        <div className="info-panel-empty">{t("info.noFiles")}</div>
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
          </a>
        ))}
      </div>
      {hasMore && !loading && (
        <button className="info-load-more-btn" onClick={onLoadMore}>{t("info.loadMore")}</button>
      )}
      {loading && <div className="info-panel-loading">{t("info.loading")}</div>}
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
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<Tab>(chatType === "GROUP" ? "members" : "media");
  const [membersAddMode, setMembersAddMode] = useState(false);

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
    setMembersAddMode(false);
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
  const tabLabels: Record<Tab, string> = {
    members: t("info.tabs.members"),
    media: t("info.tabs.media"),
    files: t("info.tabs.files"),
  };

  return (
    <div className={`chat-info-panel ${isOpen ? "open" : ""}${isMobile && isOpen ? " info-panel-mobile" : ""}`}>
      <div className="info-chat-header">
        <span className="info-close-icon" onClick={onClose} />
        {chatType === "GROUP" && onLeave && (
          <span className="info-leave-icon" onClick={onLeave} title={t("info.leaveGroup")} />
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
            chatId={chatId}
            addMode={membersAddMode}
            onEnterAddMode={() => setMembersAddMode(prev => !prev)}
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

      {activeTab === "members" && !membersAddMode && (
        <div className="info-bottom-bar">
          <button className="info-add-user-btn" onClick={() => setMembersAddMode(true)}>
            <img src="/icons/add-user.png" alt="" className="info-add-user-icon" />
            {t("info.addUser")}
          </button>
        </div>
      )}
    </div>
  );
}
