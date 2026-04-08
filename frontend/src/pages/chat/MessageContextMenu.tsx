import { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { EmojiPicker } from "./EmojiPicker";

const COLLAPSED_W = 220;
const EXPANDED_W = 340;
const COLLAPSED_H = 220;
const EXPANDED_H = 400;

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
  onReact: (emoji: string) => void;
}) {
  const { menu, onReply, onCopy, onEdit, onDelete, onReact } = props;
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const adjustedX = Math.min(menu.x, window.innerWidth - (expanded ? EXPANDED_W : COLLAPSED_W));
  const adjustedY = Math.min(menu.y, window.innerHeight - (expanded ? EXPANDED_H : COLLAPSED_H));

  return (
    <div
      className="message-context-menu"
      style={{ left: adjustedX, top: adjustedY }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <EmojiPicker onSelect={onReact} expanded={expanded} onExpandChange={setExpanded} />
      <div className="context-menu-separator" />
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

