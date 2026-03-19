export function ScrollToBottomButton(props: {
  hasMoreNewer: boolean;
  onJumpToLatest: () => void;
}) {
  const { hasMoreNewer, onJumpToLatest } = props;

  return (
    <button
      className="scroll-to-bottom-btn"
      onClick={() => {
        if (hasMoreNewer) {
          onJumpToLatest();
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
