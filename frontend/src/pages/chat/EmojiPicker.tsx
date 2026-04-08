const QUICK_EMOJIS = ["🔥", "❤️", "😁", "🤯"];

const ALL_EMOJIS = [
    "🔥", "❤️", "😁", "🤯", "😢", "😡", "🎉", "👍",
    "👏", "🙏", "😍", "🤔", "😎", "🥳", "😭", "🤣",
    "✅", "💯", "🙌", "👀", "😅", "🤦", "🤷", "💪",
    "🫡", "😤", "🥰", "😬", "🫶", "💀", "😏", "😒",
    "🤩", "😴", "🥺", "🤗", "😌", "😳", "😮", "🫠",
    "😊", "🤝", "👋", "😂", "💔", "⭐", "🚀", "💡",
    "👎", "🫣", "❓", "❗", "🎯", "✨", "🙈", "🤌",
    "👌", "🫰", "📌", "💬", "😇", "🤐", "🫥", "🥴",
];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    expanded: boolean;
    onExpandChange: (v: boolean) => void;
}

export function EmojiPicker({ onSelect, expanded, onExpandChange }: EmojiPickerProps) {
    if (expanded) {
        return (
            <div className="emoji-full-grid">
                {ALL_EMOJIS.map((emoji) => (
                    <button
                        key={emoji}
                        className="emoji-btn"
                        onClick={() => onSelect(emoji)}
                        type="button"
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="emoji-quick-bar">
            {QUICK_EMOJIS.map((emoji) => (
                <button
                    key={emoji}
                    className="emoji-btn"
                    onClick={() => onSelect(emoji)}
                    type="button"
                >
                    {emoji}
                </button>
            ))}
            <button
                className="emoji-expand-btn"
                onClick={() => onExpandChange(true)}
                type="button"
                aria-label="More emojis"
            >
                +
            </button>
        </div>
    );
}
