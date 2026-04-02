import { useState, useEffect, useRef } from "react";

export function ChatHeader(props: {
  chatName: string;
  chatType: string | null;
  participantsCount: number;
  isOnline?: boolean;
  typingText?: string;
  onHeaderClick: () => void;
  onToggleInfo: () => void;
  onToggleSearch: () => void;
  isSearchOpen: boolean;
  onBack?: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  isInCall?: boolean;
}) {
  const { chatName, chatType, participantsCount, isOnline, typingText, onHeaderClick, onToggleInfo, onToggleSearch, isSearchOpen, onBack, onCall, onVideoCall, isInCall } = props;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [mobileMenuOpen]);

  const renderSubtitle = () => {
    if (chatType === "PRIVATE") {
      if (typingText) return <div className="chat-header-typing">{typingText}</div>;
      if (isOnline)   return <div className="chat-header-online">online</div>;
      return null;
    }
    if (chatType === "GROUP") {
      if (typingText) return <div className="chat-header-typing">{typingText}</div>;
      return (
        <div className="chat-header-members" onClick={onHeaderClick}>
          {participantsCount} members
        </div>
      );
    }
    return null;
  };

  const mobileMenuItems = [
    ...(chatType === "PRIVATE" && onCall ? [{
      icon: "/icons/phone.png", label: "Audio Call",
      action: () => { if (!isInCall) onCall(); setMobileMenuOpen(false); },
      disabled: !!isInCall,
    }] : []),
    ...(chatType === "PRIVATE" && onVideoCall ? [{
      icon: "/icons/cam-recorder.png", label: "Video Call",
      action: () => { if (!isInCall) onVideoCall(); setMobileMenuOpen(false); },
      disabled: !!isInCall,
    }] : []),
    {
      icon: "/icons/search.png", label: "Search",
      action: () => { onToggleSearch(); setMobileMenuOpen(false); },
      disabled: false,
    },
    {
      icon: "/icons/info.png", label: "Chat Info",
      action: () => { onToggleInfo(); setMobileMenuOpen(false); },
      disabled: false,
    },
  ];

  return (
    <div className="chat-header">
      {onBack && (
        <button className="chat-header-back-btn" onClick={onBack} aria-label="Back">
          <img src="/icons/left-chevron.png" alt="back" />
        </button>
      )}
      <div className="chat-header-avatar" onClick={onHeaderClick}>
        {chatName ? chatName.charAt(0).toUpperCase() : "?"}
      </div>

      <div className="chat-header-info">
        <div className="chat-header-name" onClick={onHeaderClick}>
          {chatName}
        </div>
        {renderSubtitle()}
      </div>

      {/* Desktop actions */}
      <div className="chat-header-actions chat-header-actions--desktop">
        {chatType === "PRIVATE" && onCall && (
          <button
            className={`chat-menu-btn${isInCall ? " disabled" : ""}`}
            onClick={!isInCall ? onCall : undefined}
            title="Voice call"
            style={isInCall ? { opacity: 0.4, pointerEvents: "none" } : undefined}
          >
            <img src="/icons/phone.png" alt="call" />
          </button>
        )}
        {chatType === "PRIVATE" && onVideoCall && (
          <button
            className={`chat-menu-btn${isInCall ? " disabled" : ""}`}
            onClick={!isInCall ? onVideoCall : undefined}
            title="Video call"
            style={isInCall ? { opacity: 0.4, pointerEvents: "none" } : undefined}
          >
            <img style={{width: 30, height: 30}} src="/icons/cam-recorder.png" alt="video call" />
          </button>
        )}
        <button
          className={`chat-menu-btn${isSearchOpen ? " active" : ""}`}
          onClick={onToggleSearch}
          title="Search messages"
        >
          <img src="/icons/search.png" alt="search" />
        </button>
        <button className="chat-menu-btn" onClick={onToggleInfo}>
          <img src="/icons/menu.png" alt="menu" />
        </button>
      </div>

      {/* Mobile actions */}
      <div className="chat-header-actions chat-header-actions--mobile" ref={menuRef}>
        <button
          className="chat-menu-btn"
          onClick={() => setMobileMenuOpen(v => !v)}
          aria-label="More options"
        >
          <img src="/icons/dots.png" alt="more" />
        </button>

        {mobileMenuOpen && (
          <div className="chat-header-mobile-menu">
            {mobileMenuItems.map(item => (
              <button
                key={item.label}
                className="chat-header-mobile-menu-item"
                onClick={item.action}
                style={item.disabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}
              >
                <img src={item.icon} alt={item.label} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
