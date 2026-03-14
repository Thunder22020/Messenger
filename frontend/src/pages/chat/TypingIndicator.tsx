export function TypingIndicator(props: { text: string }) {
  return (
    <div className="typing-indicator-bar">
      <div className="typing-dots-container">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-indicator-text">{props.text}</span>
    </div>
  );
}

