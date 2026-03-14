import type { ChatParticipant } from "./chatTypes";

export function ChatInfoPanel(props: {
  isOpen: boolean;
  chatName: string;
  chatType: string | null;
  participants: ChatParticipant[];
  currentUsername: string | null;
  onUserClick: (userId: number) => void;
}) {
  const { isOpen, chatName, chatType, participants, currentUsername, onUserClick } = props;

  return (
    <div className={`chat-info-panel ${isOpen ? "open" : ""}`}>
      <div className="info-chat-header">
        <div className="info-chat-avatar">
          {chatName ? chatName.charAt(0).toUpperCase() : "?"}
        </div>

        <div className="info-chat-name">{chatName}</div>
      </div>

      {chatType === "GROUP" && (
        <>
          <div className="info-divider" />

          <div className="info-section-title">Members</div>

          <div className="info-members">
            {[...participants]
              .sort((a, b) => {
                if (a.username === currentUsername) return -1;
                if (b.username === currentUsername) return 1;
                return 0;
              })
              .map((user) => {
                const isMe = user.username === currentUsername;
                return (
                  <div
                    key={user.id}
                    className="info-member"
                    onClick={() => onUserClick(user.id)}
                  >
                    <div className="info-avatar">
                      {user.username.charAt(0).toUpperCase()}
                    </div>

                    <span className="info-member-name">{user.username}</span>

                    {isMe && <span className="info-you-label">You</span>}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

