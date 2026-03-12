import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../config";
import { useState, useEffect, useRef } from "react";
import { authFetch } from "../utils/authFetch";
import { useWebSocket } from "../context/WebSocketContext";
import { jwtDecode } from "jwt-decode";

const sortByLastMessage = (a: any, b: any) => {
    if (!a.lastMessageCreatedAt) return 1;
    if (!b.lastMessageCreatedAt) return -1;
    return new Date(b.lastMessageCreatedAt).getTime() - new Date(a.lastMessageCreatedAt).getTime();
};

export default function AppLayout({ children, rightPanel }: {
    children: React.ReactNode; rightPanel?: React.ReactNode;
}) {
    const navigate = useNavigate();
    const { chatId } = useParams();
    const token = localStorage.getItem("accessToken");

    let currentUsername = "";
    if (token) {
        try {
            const payload: any = jwtDecode(token);
            currentUsername = payload.sub;
        } catch { /* empty */ }
    }

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem("sidebarWidth");
        return saved ? Number(saved) : 300;
    });
    const [isResizing, setIsResizing] = useState(false);
    const [chats, setChats] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);
    const [typingByChatId, setTypingByChatId] = useState<{ [chatId: string]: string[] }>({});
    const sidebarTypingTimersRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
    const client = useWebSocket();

    const reloadChats = async () => {
        const res = await authFetch(`${API_URL}/chat/my`);

        if (!res || !res.ok) return;

        const data = await res.json();
        setChats([...data].sort(sortByLastMessage));
    };

    useEffect(() => {
        localStorage.setItem("sidebarWidth", String(sidebarWidth));
    }, [sidebarWidth]);

    useEffect(() => {
        reloadChats();
    }, []);

    useEffect(() => {
        if (!client) return;

        const subscription = client.subscribe(
            "/user/queue/chat-updates",
            async (msg) => {
                const body = JSON.parse(msg.body);

                setChats(prev => {
                    const exists = prev.some(chat => chat.chatId === body.chatId);

                    if (!exists) {
                        reloadChats();
                        return prev;
                    }

                    const updated = prev.map(chat =>
                        chat.chatId === body.chatId
                            ? {
                                ...chat,
                                lastMessageContent: body.lastMessageContent,
                                lastMessageCreatedAt: body.lastMessageCreatedAt,
                                unreadCount: body.unreadCount
                            }
                            : chat
                    );

                    return [...updated].sort(sortByLastMessage);
                });
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [client]);

    const chatIdsKey = chats.map(c => c.chatId).join(",");

    useEffect(() => {
        if (!client || chats.length === 0) return;

        const subscriptions = chats.map(chat =>
            client.subscribe(`/topic/chat.${chat.chatId}.typing`, (msg) => {
                const body = JSON.parse(msg.body);
                if (body.username === currentUsername) return;

                const cid = String(body.chatId);
                const { username, isTyping } = body;
                const timerKey = `${cid}_${username}`;

                if (sidebarTypingTimersRef.current[timerKey]) {
                    clearTimeout(sidebarTypingTimersRef.current[timerKey]);
                    delete sidebarTypingTimersRef.current[timerKey];
                }
                if (isTyping) {
                    setTypingByChatId(prev => ({
                        ...prev,
                        [cid]: prev[cid]?.includes(username) ? prev[cid] : [...(prev[cid] ?? []), username],
                    }));
                    sidebarTypingTimersRef.current[timerKey] = setTimeout(() => {
                        setTypingByChatId(prev => ({
                            ...prev,
                            [cid]: (prev[cid] ?? []).filter(u => u !== username),
                        }));
                        delete sidebarTypingTimersRef.current[timerKey];
                    }, 3000);
                } else {
                    setTypingByChatId(prev => ({
                        ...prev,
                        [cid]: (prev[cid] ?? []).filter(u => u !== username),
                    }));
                }
            })
        );

        return () => {
            subscriptions.forEach(sub => sub.unsubscribe());
            Object.values(sidebarTypingTimersRef.current).forEach(clearTimeout);
            sidebarTypingTimersRef.current = {};
            setTypingByChatId({});
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, chatIdsKey]);

    const getSidebarTypingLabel = (chat: any): string | null => {
        const users = typingByChatId[String(chat.chatId)];
        if (!users || users.length === 0) return null;
        if (chat.type === "PRIVATE") return "typing...";
        if (users.length === 1) return `${users[0]} is typing...`;
        if (users.length === 2) return `${users[0]}, ${users[1]} are typing...`;
        return `${users[0]}, ${users[1]} and ${users.length - 2} other${users.length - 2 > 1 ? "s" : ""} are typing...`;
    };

    const filteredChats = searchQuery.trim()
        ? chats.filter(c => c.displayName.toLowerCase().includes(searchQuery.toLowerCase().trim()))
        : chats;

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            const res = await authFetch(
                `${API_URL}/users/search?query=${searchQuery}`
            );

            if (!res || !res.ok) return;

            const data = await res.json();
            setSearchResults(data);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleLogout = async () => {
        const token = localStorage.getItem("accessToken");

        await fetch(`${API_URL}/api/auth/logout`, {
            method: "POST",
            credentials: "include",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        localStorage.removeItem("accessToken");
        navigate("/login");
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            const newWidth = Math.min(500, Math.max(280, e.clientX));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing]);

    return (
        <div className="app-layout">
            <div className="sidebar" style={{ width: sidebarWidth }}>
                <div className="sidebar-header">
                    <button className="sidebar-profile-btn" onClick={() => setShowLogoutPopup(true)}>
                        <div className="sidebar-avatar-sm">
                            {currentUsername.charAt(0).toUpperCase()}
                        </div>
                    </button>

                    <span className="sidebar-title">Chats</span>

                    <button className="sidebar-create-btn" onClick={() => navigate("/group")}>
                        <img src="/icons/people.png" alt="create group" />
                    </button>
                </div>

                <div className="sidebar-search-wrapper">
                    <input
                        className="sidebar-search-input"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="sidebar-divider" />

                <div className="chat-list-wrapper">
                    {!searchQuery.trim() ? (
                        <div className="chat-list">
                            {chats.length === 0 && (
                                <div className="chat-list-empty">
                                    No chats yet
                                </div>
                            )}

                            {chats.map((chat) => {
                                const formattedTime = chat.lastMessageCreatedAt
                                    ? new Date(chat.lastMessageCreatedAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })
                                    : "";

                                return (
                                    <div
                                        key={chat.chatId}
                                        className={`chat-tile fade-item ${
                                            String(chat.chatId) === chatId ? "active" : ""
                                        }`}
                                        onClick={() => navigate(`/chat/${chat.chatId}`)}
                                    >
                                        <div className="chat-avatar">
                                            {chat.displayName.charAt(0).toUpperCase()}
                                        </div>

                                        <div className="chat-info">
                                            <div className="chat-top">
                                                <div className={`chat-display-name ${chat.unreadCount > 0 ? "unread" : ""}`}>
                                                    {chat.displayName}
                                                </div>

                                                <div className="chat-tile-meta">
                                                    <div className="chat-time">{formattedTime}</div>

                                                    {chat.unreadCount > 0 && (
                                                        <span className="unread-badge">
                                                            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {getSidebarTypingLabel(chat) ? (
                                                <div className="chat-last-message typing">{getSidebarTypingLabel(chat)}</div>
                                            ) : (
                                                <div className={`chat-last-message ${chat.unreadCount > 0 ? "unread" : ""}`}>
                                                    {chat.lastMessageContent ?? "No messages yet"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="search-results-panel">
                            {filteredChats.length > 0 && (
                                <div className="search-section">
                                    <div className="search-section-label">Chats</div>
                                    <div className="search-chat-list">
                                        {filteredChats.map((chat) => {
                                            const formattedTime = chat.lastMessageCreatedAt
                                                ? new Date(chat.lastMessageCreatedAt).toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })
                                                : "";

                                            return (
                                                <div
                                                    key={chat.chatId}
                                                    className={`chat-tile fade-item ${
                                                        String(chat.chatId) === chatId ? "active" : ""
                                                    }`}
                                                    onClick={() => navigate(`/chat/${chat.chatId}`)}
                                                >
                                                    <div className="chat-avatar">
                                                        {chat.displayName.charAt(0).toUpperCase()}
                                                    </div>

                                                    <div className="chat-info">
                                                        <div className="chat-top">
                                                            <div className={`chat-display-name ${chat.unreadCount > 0 ? "unread" : ""}`}>
                                                                {chat.displayName}
                                                            </div>

                                                            <div className="chat-tile-meta">
                                                                <div className="chat-time">{formattedTime}</div>

                                                                {chat.unreadCount > 0 && (
                                                                    <span className="unread-badge">
                                                                        {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {getSidebarTypingLabel(chat) ? (
                                                            <div className="chat-last-message typing">{getSidebarTypingLabel(chat)}</div>
                                                        ) : (
                                                            <div className={`chat-last-message ${chat.unreadCount > 0 ? "unread" : ""}`}>
                                                                {chat.lastMessageContent ?? "No messages yet"}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="search-section">
                                <div className="search-section-label">People</div>

                                {searchResults.length === 0 ? (
                                    <div className="search-section-empty">No people found</div>
                                ) : (
                                    searchResults.map((user) => (
                                        <div
                                            key={user.id}
                                            className="search-person-tile fade-item"
                                            onClick={() => navigate(`/user/${user.id}`)}
                                        >
                                            <div className="search-person-avatar">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="search-person-name">{user.username}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {showLogoutPopup && (
                    <div className="logout-popup-overlay">
                        <div className="logout-popup">
                            <div className="logout-title">Logout?</div>

                            <div className="logout-subtitle">
                                Are you sure you want to sign out?
                            </div>

                            <div className="logout-actions">
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowLogoutPopup(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    className="logout-confirm-btn"
                                    onClick={handleLogout}
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div
                    className="sidebar-resizer"
                    onMouseDown={() => setIsResizing(true)}
                />
            </div>

            <div className="content">
                {children}
            </div>

            {rightPanel}
        </div>
    );
}
