import { useEffect, useRef, useState } from "react";
import AppLayout from "../components/AppLayout";
import { authFetch } from "../utils/authFetch";
import { useNavigate, useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useWebSocket } from "../context/WebSocketContext";
import { API_URL } from "../config";

interface Message {
    id: number;
    content: string;
    sender: string;
    createdAt: string;
    editedAt: string | null;
    deletedAt: string | null;
}

interface JwtPayload {
    sub: string;
    exp: number;
}

export default function ChatPage() {
    const { chatId } = useParams();
    const numericChatId = chatId ? Number(chatId) : null;

    const [messages, setMessages] = useState<Message[]>([]);
    const navigate = useNavigate();
    const [chatName, setChatName] = useState<string>("");
    const [participants, setParticipants] = useState<{ id: number; username: string }[]>([]);
    const [chatType, setChatType] = useState<string | null>(null);
    const [input, setInput] = useState("");
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: number; content: string } | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [editingOriginalContent, setEditingOriginalContent] = useState("");
    const [deletingMessageIds, setDeletingMessageIds] = useState<Set<number>>(new Set());

    const COLLAPSE_MS = 320;
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const oldestIdRef = useRef<number | null>(null);
    const shouldScrollToBottom = useRef(true);
    const shouldRestoreScroll = useRef(false);
    const savedScrollHeight = useRef(0);
    const client = useWebSocket();

    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const typingTimersRef = useRef<{ [u: string]: ReturnType<typeof setTimeout> }>({});
    const typingSentRef = useRef(false);
    const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const token = localStorage.getItem("accessToken");

    const currentUsername = token
        ? jwtDecode<JwtPayload>(token).sub
        : null;

    const handleHeaderClick = () => {
        if (chatType === "PRIVATE") {
            const otherUser = participants.find(p => p.username !== currentUsername);
            if (!otherUser) return;
            navigate(`/user/${otherUser.id}`);
            return;
        }

        if (chatType === "GROUP") {
            setIsInfoOpen(prev => !prev);
        }
    };

    useEffect(() => {
        if (!numericChatId) return;

        const loadChatInfo = async () => {
            const res = await authFetch(`${API_URL}/chat/my`);
            if (!res || !res.ok) return;

            const data = await res.json();
            const currentChat = data.find((c: any) => c.chatId === numericChatId);

            if (currentChat) {
                setChatName(currentChat.displayName);
                setChatType(currentChat.type);
            }
        };

        loadChatInfo();
    }, [numericChatId]);

    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 150);
        return () => clearTimeout(t);
    }, [numericChatId]);

    useEffect(() => {
        if (!numericChatId) return;

        oldestIdRef.current = null;
        shouldScrollToBottom.current = true;

        const loadMessages = async () => {
            const res = await authFetch(
                `${API_URL}/messages/${numericChatId}`
            );

            if (!res || !res.ok) return;

            const data = await res.json();
            const visible = data.messages.filter((m: Message) => !m.deletedAt);
            setMessages(visible);
            setHasMore(data.hasMore);
            if (visible.length > 0) {
                oldestIdRef.current = visible[0].id;
            }
        };

        loadMessages();
    }, [numericChatId]);

    const loadOlderMessages = async () => {
        if (!hasMore || isLoadingMore || !numericChatId || oldestIdRef.current === null) return;

        setIsLoadingMore(true);
        savedScrollHeight.current = chatContainerRef.current?.scrollHeight ?? 0;
        shouldScrollToBottom.current = false;
        shouldRestoreScroll.current = true;

        const res = await authFetch(
            `${API_URL}/messages/${numericChatId}?before=${oldestIdRef.current}`
        );

        if (!res || !res.ok) {
            setIsLoadingMore(false);
            return;
        }

        const data = await res.json();
        const visible = data.messages.filter((m: Message) => !m.deletedAt);
        setMessages(prev => [...visible, ...prev]);
        setHasMore(data.hasMore);
        if (visible.length > 0) {
            oldestIdRef.current = visible[0].id;
        }
        setIsLoadingMore(false);
    };

    useEffect(() => {
        if (!client || !numericChatId) return;

        const subscription = client.subscribe(
            `/topic/chat.${numericChatId}`,
            (msg) => {
                const body: Message = JSON.parse(msg.body);
                setMessages(prev => {
                    const idx = prev.findIndex(m => m.id === body.id);
                    if (idx === -1) {
                        if (body.deletedAt) return prev;
                        shouldScrollToBottom.current = true;
                        return [...prev, body];
                    }
                    if (body.deletedAt) return prev; // Handled optimistically in handleDeleteMessage
                    const next = [...prev];
                    next[idx] = body;
                    return next;
                });
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [client, numericChatId]);

    useEffect(() => {
        if (!client || !numericChatId) return;

        const subscription = client.subscribe(
            `/topic/chat.${numericChatId}.typing`,
            (msg) => {
                const body = JSON.parse(msg.body);
                if (body.username === currentUsername) return;

                const { username, isTyping } = body;
                if (typingTimersRef.current[username]) {
                    clearTimeout(typingTimersRef.current[username]);
                    delete typingTimersRef.current[username];
                }

                if (isTyping) {
                    setTypingUsers(prev => prev.includes(username) ? prev : [...prev, username]);
                    typingTimersRef.current[username] = setTimeout(() => {
                        setTypingUsers(prev => prev.filter(u => u !== username));
                        delete typingTimersRef.current[username];
                    }, 3000);
                } else {
                    setTypingUsers(prev => prev.filter(u => u !== username));
                }
            }
        );

        return () => {
            subscription.unsubscribe();
            if (typingStopTimerRef.current) {
                clearTimeout(typingStopTimerRef.current);
                typingStopTimerRef.current = null;
            }
            if (typingSentRef.current) {
                typingSentRef.current = false;
                client.publish({
                    destination: "/app/chat.typing",
                    body: JSON.stringify({ chatId: numericChatId, isTyping: false }),
                });
            }
            Object.values(typingTimersRef.current).forEach(clearTimeout);
            typingTimersRef.current = {};
            setTypingUsers([]);
        };
    }, [client, numericChatId]);

    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container || messages.length === 0) return;

        if (shouldScrollToBottom.current) {
            container.scrollTop = container.scrollHeight;
            shouldScrollToBottom.current = false;
        } else if (shouldRestoreScroll.current) {
            container.scrollTop = container.scrollHeight - savedScrollHeight.current;
            shouldRestoreScroll.current = false;
        }
        // else: edit/delete — don't touch scroll position
    }, [messages]);

    useEffect(() => {
        if (!numericChatId) return;
        authFetch(
            `${API_URL}/chat/${numericChatId}/read`,
            { method: "POST" }
        );
    }, [numericChatId]);

    useEffect(() => {
        if (!numericChatId) return;

        const loadParticipants = async () => {
            const res = await authFetch(
                `${API_URL}/chat/${numericChatId}/participants`
            );

            if (!res || !res.ok) return;

            const data = await res.json();
            setParticipants(data);
        };

        loadParticipants();
    }, [numericChatId, chatType]);

    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [contextMenu]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (contextMenu) {
                setContextMenu(null);
            } else if (editingMessageId !== null) {
                setEditingMessageId(null);
                setEditingOriginalContent("");
                setInput("");
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [contextMenu, editingMessageId]);

    const adjustTextarea = () => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.overflowY = "hidden";
        el.style.height = el.scrollHeight + "px";
        const computedH = parseInt(getComputedStyle(el).height, 10);
        if (el.scrollHeight > computedH) {
            el.style.overflowY = "auto";
        }
    };

    useEffect(() => {
        adjustTextarea();
    }, [input]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        if (!client || !numericChatId || editingMessageId !== null) return;

        if (!typingSentRef.current) {
            typingSentRef.current = true;
            client.publish({
                destination: "/app/chat.typing",
                body: JSON.stringify({ chatId: numericChatId, isTyping: true }),
            });
        }
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = setTimeout(() => {
            typingSentRef.current = false;
            typingStopTimerRef.current = null;
            client.publish({
                destination: "/app/chat.typing",
                body: JSON.stringify({ chatId: numericChatId, isTyping: false }),
            });
        }, 1500);
    };

    const sendMessage = async () => {
        if (!input.trim()) return;

        if (typingStopTimerRef.current) {
            clearTimeout(typingStopTimerRef.current);
            typingStopTimerRef.current = null;
        }
        if (typingSentRef.current) {
            typingSentRef.current = false;
            client?.publish({
                destination: "/app/chat.typing",
                body: JSON.stringify({ chatId: numericChatId, isTyping: false }),
            });
        }

        if (editingMessageId !== null) {
            await authFetch(`${API_URL}/messages/${editingMessageId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: input }),
            });
            setEditingMessageId(null);
            setEditingOriginalContent("");
            setInput("");
            return;
        }

        if (!client || !numericChatId) return;

        client.publish({
            destination: "/app/chat.send",
            body: JSON.stringify({
                chatId: numericChatId,
                content: input,
            }),
        });

        setInput("");
    };

    const getTypingText = (): string => {
        if (chatType === "PRIVATE") return "typing...";
        if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
        if (typingUsers.length === 2) return `${typingUsers[0]}, ${typingUsers[1]} are typing...`;
        return `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers.length - 2} other${typingUsers.length - 2 > 1 ? "s" : ""} are typing...`;
    };

    const formatDateSeparator = (dateStr: string): string => {
        const date = new Date(dateStr);
        const now = new Date();
        if (date.toDateString() === now.toDateString()) return "Today";
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
        const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
        if (date.getFullYear() !== now.getFullYear()) opts.year = "numeric";
        return date.toLocaleDateString("en-US", opts);
    };

    const handleMessageRightClick = (e: React.MouseEvent, msg: Message) => {
        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - 148);
        const y = Math.min(e.clientY, window.innerHeight - 96);
        setContextMenu({ x, y, messageId: msg.id, content: msg.content });
    };

    const handleDeleteMessage = async () => {
        if (!contextMenu) return;
        const messageId = contextMenu.messageId;
        setContextMenu(null);

        setDeletingMessageIds(ids => new Set([...ids, messageId]));
        setTimeout(() => {
            setMessages(m => m.filter(x => x.id !== messageId));
            setDeletingMessageIds(ids => {
                const n = new Set(ids);
                n.delete(messageId);
                return n;
            });
        }, COLLAPSE_MS);

        await authFetch(`${API_URL}/messages/${messageId}`, { method: "DELETE" });
    };

    const handleStartEdit = () => {
        if (!contextMenu) return;
        setEditingMessageId(contextMenu.messageId);
        setEditingOriginalContent(contextMenu.content);
        setInput(contextMenu.content);
        setContextMenu(null);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditingOriginalContent("");
        setInput("");
    };

    interface SenderGroup { sender: string; messages: Message[]; }
    interface DateGroup { dateKey: string; label: string; senderGroups: SenderGroup[]; }

    const dateGroups: DateGroup[] = [];
    for (const msg of messages) {
        const dateKey = new Date(msg.createdAt).toDateString();
        let dg = dateGroups[dateGroups.length - 1];
        if (!dg || dg.dateKey !== dateKey) {
            dg = { dateKey, label: formatDateSeparator(msg.createdAt), senderGroups: [] };
            dateGroups.push(dg);
        }
        const lastSG = dg.senderGroups[dg.senderGroups.length - 1];
        if (lastSG && lastSG.sender === msg.sender) {
            lastSG.messages.push(msg);
        } else {
            dg.senderGroups.push({ sender: msg.sender, messages: [msg] });
        }
    }

    return (
        <AppLayout
            rightPanel={
                <div className={`chat-info-panel ${isInfoOpen ? "open" : ""}`}>

                    <div className="info-chat-header">
                        <div className="info-chat-avatar">
                            {chatName ? chatName.charAt(0).toUpperCase() : "?"}
                        </div>

                        <div className="info-chat-name">
                            {chatName}
                        </div>
                    </div>

                    {chatType === "GROUP" && (
                        <>
                            <div className="info-divider" />

                            <div className="info-section-title">
                                Members
                            </div>

                            <div className="info-members">
                                {[...participants].sort((a, b) => {
                                    if (a.username === currentUsername) return -1;
                                    if (b.username === currentUsername) return 1;
                                    return 0;
                                }).map(user => {
                                    const isMe = user.username === currentUsername;

                                    return (
                                        <div
                                            key={user.id}
                                            className="info-member"
                                            onClick={() => navigate(`/user/${user.id}`)}
                                        >
                                            <div className="info-avatar">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>

                                            <span className="info-member-name">
                                                {user.username}
                                            </span>

                                            {isMe && (
                                                <span className="info-you-label">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                </div>
            }
        >
            <div className="chat-container">
                <div className="chat-header">
                    <div className="chat-header-avatar" onClick={handleHeaderClick}>
                        {chatName ? chatName.charAt(0).toUpperCase() : "?"}
                    </div>

                    <div className="chat-header-info">
                        <div className="chat-header-name" onClick={handleHeaderClick}>
                            {chatName}
                        </div>

                        {chatType === "GROUP" && (
                            <div className="chat-header-members" onClick={handleHeaderClick}>
                                {participants.length} members
                            </div>
                        )}
                    </div>

                    <button
                        className="chat-menu-btn"
                        onClick={() => setIsInfoOpen(prev => !prev)}
                    >
                        <img src="/icons/menu.png" alt="menu" />
                    </button>
                </div>

                <div
                    className="chat-messages"
                    ref={chatContainerRef}
                    onScroll={() => {
                        const el = chatContainerRef.current;
                        if (!el) return;
                        if (el.scrollTop === 0) loadOlderMessages();
                        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                        setShowScrollBtn(distFromBottom > 100);
                    }}
                >
                    <div className="messages-column">
                        {dateGroups.map((dateGroup) => (
                            <div key={dateGroup.dateKey} className="date-section">
                                <div className="date-separator">
                                    <span className="date-pill">{dateGroup.label}</span>
                                </div>

                                {dateGroup.senderGroups.map((group) => {
                                    const isMine = group.sender === currentUsername;

                                    return (
                                        <div
                                            key={group.messages[0].id}
                                            className={`message-group ${isMine ? "mine" : "other"}`}
                                        >
                                            {!isMine && chatType === "GROUP" && (
                                                <div className="group-sender-label">
                                                    {group.sender}
                                                </div>
                                            )}

                                            {group.messages.map((msg, msgIdx) => {
                                                const isLast = msgIdx === group.messages.length - 1;
                                                const formattedTime = new Date(msg.createdAt)
                                                    .toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit"
                                                    });

                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className={`message-row-collapse${deletingMessageIds.has(msg.id) ? " collapsing" : ""}`}
                                                    >
                                                        <div className={`message-row ${isMine ? "mine" : "other"}`}>
                                                            {!isMine && chatType === "GROUP" && (
                                                                isLast
                                                                    ? <div className="message-avatar">{group.sender.charAt(0).toUpperCase()}</div>
                                                                    : <div className="message-avatar-spacer" />
                                                            )}

                                                            <div
                                                                className="message-bubble"
                                                                onContextMenu={isMine ? (e) => handleMessageRightClick(e, msg) : undefined}
                                                            >
                                                                <div className="message-content">
                                                                    <span className="message-text">
                                                                        {msg.content}
                                                                    </span>

                                                                    <span className="message-time">
                                                                        {msg.editedAt && (
                                                                            <img
                                                                                src="/icons/edit.png"
                                                                                className="message-edited-icon"
                                                                                alt="edited"
                                                                            />
                                                                        )}
                                                                        {formattedTime}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {showScrollBtn && (
                    <button
                        className="scroll-to-bottom-btn"
                        onClick={() => {
                            chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
                        }}
                    >
                        <img src="/icons/arrow-down.png" alt="scroll to bottom" />
                    </button>
                )}

                {typingUsers.length > 0 && (
                    <div className="typing-indicator-bar">
                        <div className="typing-dots-container">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                        </div>
                        <span className="typing-indicator-text">{getTypingText()}</span>
                    </div>
                )}

                {editingMessageId !== null && (
                    <div className="chat-edit-bar">
                        <div className="chat-edit-bar-accent" />
                        <div className="chat-edit-bar-content">
                            <span className="chat-edit-bar-label">Editing</span>
                            <span className="chat-edit-bar-preview">{editingOriginalContent}</span>
                        </div>
                        <button className="chat-edit-cancel-btn" onClick={cancelEditing}>✕</button>
                    </div>
                )}

                <div className="chat-input-bar">
                    <textarea
                        key={numericChatId}
                        ref={inputRef}
                        className="chat-input-field"
                        placeholder="Type something..."
                        value={input}
                        rows={1}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                    />
                    <div className="chat-input-divider" />
                    <button className="chat-send-btn" onClick={sendMessage}>
                        <img src="/icons/send.png" alt="send" />
                    </button>
                </div>

                {contextMenu && (
                    <div
                        className="message-context-menu"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <button className="context-menu-item" onClick={handleStartEdit}>Edit</button>
                        <button className="context-menu-item danger" onClick={handleDeleteMessage}>Delete</button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
