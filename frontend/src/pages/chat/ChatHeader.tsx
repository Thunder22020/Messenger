export function ChatHeader(props: {
  chatName: string;
  chatType: string | null;
  participantsCount: number;
  isOnline?: boolean;
  typingText?: string;
  onHeaderClick: () => void;
  onToggleInfo: () => void;
}) {
  const { chatName, chatType, participantsCount, isOnline, typingText, onHeaderClick, onToggleInfo } = props;

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

  return (
    <div className="chat-header">
      <div className="chat-header-avatar" onClick={onHeaderClick}>
        {chatName ? chatName.charAt(0).toUpperCase() : "?"}
      </div>

      <div className="chat-header-info">
        <div className="chat-header-name" onClick={onHeaderClick}>
          {chatName}
        </div>
        {renderSubtitle()}
      </div>

      <button className="chat-menu-btn" onClick={onToggleInfo}>
        <img src="/icons/menu.png" alt="menu" />
      </button>
    </div>
  );
}
