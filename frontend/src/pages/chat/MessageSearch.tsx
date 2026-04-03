import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { authFetch } from "../../utils/authFetch";
import { API_URL } from "../../config";
import { formatShortDate } from "./chatFormat";
import type { Message } from "./chatTypes";

interface Props {
  chatId: number;
  onNavigate: (messageId: number) => void;
  onClose: () => void;
  isClosing: boolean;
}

export function MessageSearch({ chatId, onNavigate, onClose, isClosing }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await authFetch(
          `${API_URL}/messages/search?chatId=${chatId}&q=${encodeURIComponent(query.trim())}`
        );
        if (res && res.ok) {
          const data: Message[] = await res.json();
          setResults(data);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, chatId]);

  const handleResultClick = (id: number) => {
    onNavigate(id);
    onClose();
  };

  const getPreviewText = (msg: Message): string => {
    if (msg.content) return msg.content;
    const att = msg.attachments?.[0];
    if (!att) return "";
    const labels: Record<string, string> = { PHOTO: "Photo", VIDEO: "Video", AUDIO: "Audio", FILE: "File" };
    return labels[att.type] ?? "Attachment";
  };

  const highlight = (text: string, q: string): React.ReactNode => {
    if (!q || q.length < 3) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className={`message-search-overlay${isClosing ? " message-search-overlay--closing" : ""}`}>
      <div className="message-search-bar">
        <img className="message-search-icon-inner" src="/icons/search.png" alt="" />
        <input
          ref={inputRef}
          className="message-search-input"
          placeholder={t("chat.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="message-search-clear" onClick={onClose}>
          ✕
        </button>
      </div>

      {(results.length > 0 || (loading && query.length >= 3) || (query.length >= 3 && !loading && results.length === 0)) && (
        <div className="message-search-results">
          {loading && <div className="message-search-empty">Searching…</div>}
          {!loading && results.length === 0 && query.length >= 3 && (
            <div className="message-search-empty">No results found</div>
          )}
          {!loading && results.map((msg) => {
            const preview = getPreviewText(msg);
            const firstLetter = msg.sender ? msg.sender.charAt(0).toUpperCase() : "?";
            return (
              <button
                key={msg.id}
                className="message-search-result-tile"
                onClick={() => handleResultClick(msg.id)}
              >
                <div className="message-search-result-avatar">{firstLetter}</div>
                <div className="message-search-result-body">
                  <div className="message-search-result-header">
                    <span className="message-search-result-sender">{msg.sender}</span>
                    <span className="message-search-result-time">{formatShortDate(msg.createdAt)}</span>
                  </div>
                  <div className="message-search-result-text">
                    {highlight(preview, query.trim())}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
