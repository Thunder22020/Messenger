export function ChatHeader(props: {
  chatName: string;
  chatType: string | null;
  participantsCount: number;
  onHeaderClick: () => void;
  onToggleInfo: () => void;
}) {
  const { chatName, chatType, participantsCount, onHeaderClick, onToggleInfo } = props;

  return (
    <div className="chat-header">
      <div className="chat-header-avatar" onClick={onHeaderClick}>
        {chatName ? chatName.charAt(0).toUpperCase() : "?"}
      </div>

      <div className="chat-header-info">
        <div className="chat-header-name" onClick={onHeaderClick}>
          {chatName}
        </div>

        {chatType === "GROUP" && (
          <div className="chat-header-members" onClick={onHeaderClick}>
            {participantsCount} members
          </div>
        )}
      </div>

      <button className="chat-menu-btn" onClick={onToggleInfo}>
        <img src="/icons/menu.png" alt="menu" />
      </button>
    </div>
  );
}

