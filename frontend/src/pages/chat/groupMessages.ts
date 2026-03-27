import type { DateGroup, Message } from "./chatTypes";
import { formatDateSeparator } from "./chatFormat";

export function groupMessagesByDateAndSender(params: {
  messages: Message[];
  unreadDividerMessageId: number | null | undefined;
}): DateGroup[] {
  const { messages, unreadDividerMessageId } = params;

  const dateGroups: DateGroup[] = [];
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    let dg = dateGroups[dateGroups.length - 1];
    if (!dg || dg.dateKey !== dateKey) {
      dg = { dateKey, label: formatDateSeparator(msg.createdAt), senderGroups: [] };
      dateGroups.push(dg);
    }

    const lastSG = dg.senderGroups[dg.senderGroups.length - 1];
    const isUnreadBoundary = msg.id === unreadDividerMessageId;
    const isSystem = msg.type === "SYSTEM";
    if (lastSG && lastSG.sender === msg.sender && !isUnreadBoundary && !isSystem) {
      lastSG.messages.push(msg);
    } else {
      dg.senderGroups.push({ sender: msg.sender, messages: [msg] });
    }
  }
  return dateGroups;
}

