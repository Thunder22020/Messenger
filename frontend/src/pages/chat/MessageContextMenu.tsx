import { useLanguage } from "../../context/LanguageContext";

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
  const { t } = useLanguage();

  return (
    <div
      className="message-context-menu"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button className="context-menu-item" onClick={onReply}>
        {t("menu.reply")}
      </button>
      {menu.content && (
        <button className="context-menu-item" onClick={onCopy}>
          {t("menu.copy")}
        </button>
      )}
      {menu.isMine && (
        <>
          <button className="context-menu-item" onClick={onEdit}>
            {t("menu.edit")}
          </button>
          <button className="context-menu-item danger" onClick={onDelete}>
            {t("menu.deleteMessage")}
          </button>
        </>
      )}
    </div>
  );
}

