export type MessageContextMenuState = {
  x: number;
  y: number;
  messageId: number;
  content: string;
  sender: string;
  isMine: boolean;
};

export function MessageContextMenu(props: {
  menu: MessageContextMenuState;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { menu, onReply, onCopy, onEdit, onDelete } = props;

  return (
    <div
      className="message-context-menu"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button className="context-menu-item" onClick={onReply}>
        Reply
      </button>
      {menu.content && (
        <button className="context-menu-item" onClick={onCopy}>
          Copy text
        </button>
      )}
      {menu.isMine && (
        <>
          <button className="context-menu-item" onClick={onEdit}>
            Edit
          </button>
          <button className="context-menu-item danger" onClick={onDelete}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}

