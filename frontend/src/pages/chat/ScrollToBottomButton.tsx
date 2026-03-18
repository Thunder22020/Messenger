import type { Message } from "./chatTypes";

export function ScrollToBottomButton(props: {
  visible: boolean;
  hasMoreNewer: boolean;
  numericChatId: number | null;
  authFetch: (url: string, init?: RequestInit) => Promise<Response | undefined>;
  apiUrl: string;
  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void;
  setHasMoreOlder: (value: boolean) => void;
  setHasMoreNewer: (value: boolean) => void;
  hasMoreNewerRef: { current: boolean };
  oldestIdRef: { current: number | null };
  newestIdRef: { current: number | null };
  isAtBottomRef: { current: boolean };
  shouldScrollToBottomRef: { current: boolean };
  triggerMarkAsRead: () => void;
}) {
  const {
    visible,
    hasMoreNewer,
    numericChatId,
    authFetch,
    apiUrl,
    setMessages,
    setHasMoreOlder,
    setHasMoreNewer,
    hasMoreNewerRef,
    oldestIdRef,
    newestIdRef,
    isAtBottomRef,
    shouldScrollToBottomRef,
    triggerMarkAsRead,
  } = props;

  if (!visible) return null;

  return (
    <button
      className="scroll-to-bottom-btn"
      onClick={async () => {
        if (hasMoreNewer && numericChatId) {
          const res = await authFetch(`${apiUrl}/messages/${numericChatId}`);
          if (!res || !res.ok) return;
          const data = await res.json();
          const visibleMessages: Message[] = data.messages.filter(
            (m: Message) => !m.deletedAt
          );
          setMessages(visibleMessages);
          setHasMoreOlder(data.hasMoreOlder);
          setHasMoreNewer(false);
          hasMoreNewerRef.current = false;
          if (visibleMessages.length > 0) {
            oldestIdRef.current = visibleMessages[0].id;
            newestIdRef.current = visibleMessages[visibleMessages.length - 1].id;
          }
          isAtBottomRef.current = true;
          shouldScrollToBottomRef.current = true;
          triggerMarkAsRead();
        } else {
          const container = document.querySelector<HTMLDivElement>(".chat-messages");
          if (container) container.scrollTop = container.scrollHeight;
        }
      }}
    >
      <img src="/icons/arrow-down.png" alt="scroll to bottom" />
    </button>
  );
}
