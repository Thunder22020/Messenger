import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authFetch } from "../utils/authFetch";
import { API_URL } from "../config";
import { useShowLogout } from "../context/AppLayoutContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { MediaViewer } from "./chat/MediaViewer";
import type { AttachmentDto, UserProfile } from "./chat/chatTypes";

// ── Main page ────────────────────────────────────────────────────────
export default function UserInfoPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const showLogout = useShowLogout();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwn, setIsOwn] = useState(false);
  const [displayNameVal, setDisplayNameVal] = useState<string>("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [userRes, meRes] = await Promise.all([
        authFetch(`${API_URL}/users/${userId}`),
        authFetch(`${API_URL}/users/me`),
      ]);
      if (!userRes?.ok) { setLoading(false); return; }
      const userData: UserProfile = await userRes.json();
      setUser(userData);
      setDisplayNameVal(userData.displayName ?? "");
      if (meRes?.ok) {
        const meData: UserProfile = await meRes.json();
        setIsOwn(meData.id === userData.id);
      }
      setLoading(false);
    })();
  }, [userId]);

  const saveDisplayName = async () => {
    if (savingName) return;
    setSavingName(true);
    const res = await authFetch(`${API_URL}/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: displayNameVal.trim() || null }),
    });
    if (res?.ok) {
      setUser(u => u ? { ...u, displayName: displayNameVal.trim() || null } : u);
    }
    setSavingName(false);
    setEditingName(false);
  };

  const uploadAvatar = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await authFetch(`${API_URL}/users/me/avatar`, { method: "POST", body: fd });
    if (!res?.ok) return;
    const { avatarUrl } = await res.json();
    setUser(u => u ? { ...u, avatarUrl } : u);
  };

  const openChat = async () => {
    if (!user) return;
    const res = await authFetch(`${API_URL}/chat/private/${user.id}`, { method: "POST" });
    if (!res?.ok) return;
    const data = await res.json();
    navigate(`/chat/${data.chatId}`);
  };

  if (loading) return <div className="user-info-container"><div className="user-info-loading">Loading...</div></div>;
  if (!user) return <div className="user-info-container"><div className="user-info-loading">User not found</div></div>;

  const avatarViewerItems: AttachmentDto[] = user.avatarUrl ? [{
    id: user.id,
    url: user.avatarUrl,
    type: "PHOTO",
    fileName: `${user.username}-avatar.jpg`,
    mimeType: "image/jpeg",
    fileSize: 0,
  }] : [];

  return (
    <div className="user-info-container">
      {isMobile && (
        <button className="chat-header-back-btn user-info-back-btn" onClick={() => navigate("/chat")} aria-label="Back">
          <img src="/icons/left-chevron.png" alt="back" />
        </button>
      )}
      {isOwn && (
        <button className="user-info-logout-btn" onClick={showLogout} aria-label="Logout">
          <img src="/icons/log-out.png" alt="logout" />
        </button>
      )}

      <div className="user-profile-top">
        <div
          className={`user-profile-avatar-wrap${user.avatarUrl ? " viewable" : ""}`}
          onClick={user.avatarUrl ? () => setAvatarViewerOpen(true) : undefined}
        >
          {user.avatarUrl
            ? <img src={user.avatarUrl} className="user-profile-avatar-img" alt="" />
            : <div className="user-profile-avatar-placeholder">
                {(user.displayName ?? user.username).charAt(0).toUpperCase()}
              </div>}
          {isOwn && (
            <button
              className="user-profile-avatar-edit-icon"
              type="button"
              aria-label="Change avatar"
              onClick={(e) => {
                e.stopPropagation();
                avatarInputRef.current?.click();
              }}
            >
              ✎
            </button>
          )}
        </div>
        {isOwn && (
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); e.target.value = ""; }} />
        )}

        {/* Display name */}
        {isOwn ? (
          editingName ? (
            <input
              className="user-profile-name-input"
              value={displayNameVal}
              placeholder="Enter your name"
              onChange={e => setDisplayNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveDisplayName(); if (e.key === "Escape") setEditingName(false); }}
              onBlur={saveDisplayName}
              autoFocus
              maxLength={26}
            />
          ) : user.displayName ? (
            <div className="user-profile-name" onClick={() => setEditingName(true)}>{user.displayName}</div>
          ) : (
            <input
              className="user-profile-name-input empty"
              placeholder="Enter your name"
              onFocus={() => setEditingName(true)}
              readOnly
            />
          )
        ) : (
          user.displayName && <div className="user-profile-name">{user.displayName}</div>
        )}

        <div className="user-profile-username">@{user.username}</div>

        {!isOwn && (
          <button className="user-info-chat-btn" onClick={openChat}>Open chat</button>
        )}
      </div>
      {avatarViewerOpen && user.avatarUrl && (
        <MediaViewer
          items={avatarViewerItems}
          initialIndex={0}
          sender={user.displayName ?? user.username}
          createdAt={new Date().toISOString()}
          onClose={() => setAvatarViewerOpen(false)}
        />
      )}
    </div>
  );
}
