import { useNavigate, useMatch, Outlet } from "react-router-dom";
import { API_URL } from "../config";
import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayoutContext } from "../context/AppLayoutContext";
import { authFetch } from "../utils/authFetch";
import { useWebSocket } from "../context/WebSocketContext";
import { usePresence } from "../context/PresenceContext";
import { jwtDecode } from "jwt-decode";
import { useIsMobile } from "../hooks/useIsMobile";
import { useLongPress } from "../hooks/useLongPress";
import { formatSystemContent } from "../pages/chat/chatFormat";
import { initPushNotifications, unsubscribePush } from "../utils/pushNotifications";
import { useLanguage } from "../context/LanguageContext";

type JwtPayload = { sub: string };

type ChatListItem = {
    chatId: number;
    displayName: string;
    partnerUsername?: string | null;
    chatAvatarUrl?: string | null;
    type: "PRIVATE" | "GROUP";
    lastMessageContent?: string | null;
    lastMessageSender?: string | null;
    lastMessageCreatedAt?: string | null;
    unreadCount: number;
    pinnedAt?: string | null;
    lastMessageId?: number | null;
    peerLastReadMessageId?: number | null;
};

type UserSearchResult = {
    id: number;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
};

type ChatAvatarUpdatedDetail = {
    chatId: number;
    avatarUrl: string | null;
};

const sortChats = (a: ChatListItem, b: ChatListItem) => {
    const aPinned = a.pinnedAt != null;
    const bPinned = b.pinnedAt != null;
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    if (aPinned && bPinned) {
        return new Date(a.pinnedAt!).getTime() - new Date(b.pinnedAt!).getTime();
    }
    if (!a.lastMessageCreatedAt) return 1;
    if (!b.lastMessageCreatedAt) return -1;
    return new Date(b.lastMessageCreatedAt).getTime() - new Date(a.lastMessageCreatedAt).getTime();
};

export default function AppLayout() {
    const navigate = useNavigate();
    const [rightPanel, setRightPanel] = useState<React.ReactNode>(null);
    const setRightPanelStable = useCallback((node: React.ReactNode) => setRightPanel(node), []);
    const chatMatch = useMatch('/chat/:chatId');
    const userMatch = useMatch('/user/:userId');
    const groupMatch = useMatch('/group');
    const chatId = chatMatch?.params.chatId;
    const userId = userMatch?.params.userId;
    const token = localStorage.getItem("accessToken");

    let currentUsername = "";
    if (token) {
        try {
            const payload = jwtDecode<JwtPayload>(token);
            currentUsername = payload.sub;
        } catch { /* empty */ }
    }

    const { t, lang, setLang } = useLanguage();

    const [theme, setTheme] = useState<"dark" | "light">(() => {
        const saved = localStorage.getItem("theme") as "dark" | "light" | null;
        const t = saved || "dark";
        document.documentElement.setAttribute("data-theme", t);
        return t;
    });

    const toggleTheme = () => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        setTheme(next);
    };

    const [muteSound, setMuteSound] = useState(() => localStorage.getItem("muteSound") === "true");

    const toggleMuteSound = () => {
        setMuteSound(prev => {
            const next = !prev;
            localStorage.setItem("muteSound", String(next));
            return next;
        });
    };

    const [activeTab, setActiveTab] = useState<"chats" | "settings">("chats");

    const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
    const recentNotificationsRef = useRef<Set<number>>(new Set());
    const lastMessageTimestampRef = useRef<Map<number, string>>(new Map());
    useEffect(() => {
        notificationSoundRef.current = new Audio("/sounds/notification_sound.mp3");
        notificationSoundRef.current.volume = 0.5;
    }, []);

    useEffect(() => {
        initPushNotifications();
    }, []);

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem("sidebarWidth");
        return saved ? Number(saved) : 300;
    });
    const [isResizing, setIsResizing] = useState(false);
    const [currentUser, setCurrentUser] = useState<{ id: number; avatarUrl: string | null } | null>(null);
    const [chats, setChats] = useState<ChatListItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);
    const [chatContextMenu, setChatContextMenu] = useState<{ chatId: number; isPinned: boolean; x: number; y: number } | null>(null);
    const [deleteChatConfirm, setDeleteChatConfirm] = useState<number | null>(null);
    const [typingByChatId, setTypingByChatId] = useState<{ [chatId: string]: string[] }>({});
    const sidebarTypingTimersRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
    const activeChatIdRef = useRef(chatId);
    useEffect(() => { activeChatIdRef.current = chatId; }, [chatId]);
    const client = useWebSocket();
    const { isOnline } = usePresence();
    const isMobile = useIsMobile();

    // Mobile swipe-back refs
    const sidebarPanelRef = useRef<HTMLDivElement>(null);
    const chatPanelRef = useRef<HTMLDivElement>(null);
    const isChatActiveRef = useRef(false);
    const isAnimatingRef = useRef(false);
    useEffect(() => {
        isChatActiveRef.current = !!(chatId || userId || groupMatch);
    }, [chatId, userId, groupMatch]);

    // Animate panels to sidebar, then navigate — used by swipe gesture and back button
    const animateMobileBack = useCallback(() => {
        if (isAnimatingRef.current) return;
        isAnimatingRef.current = true;
        const sidebar = sidebarPanelRef.current;
        const chat = chatPanelRef.current;
        if (!sidebar || !chat) { navigate('/chat'); isAnimatingRef.current = false; return; }

        const tr = 'transform 0.25s cubic-bezier(0.4,0,0.2,1)';
        sidebar.style.transition = tr;
        chat.style.transition = tr;
        sidebar.style.transform = 'translateX(0)';
        chat.style.transform = 'translateX(100%)';

        chat.addEventListener('transitionend', () => {
            navigate('/chat');
            // Remove inline styles after React re-renders (CSS class takes over)
            requestAnimationFrame(() => requestAnimationFrame(() => {
                sidebar.style.cssText = '';
                chat.style.cssText = '';
                isAnimatingRef.current = false;
            }));
        }, { once: true });
    }, [navigate]);

    // Listen for back event dispatched by ChatPage back button
    useEffect(() => {
        if (!isMobile) return;
        const handler = () => animateMobileBack();
        window.addEventListener('mobile-chat-back', handler);
        return () => window.removeEventListener('mobile-chat-back', handler);
    }, [isMobile, animateMobileBack]);

    // Swipe-right-to-go-back gesture (non-passive so we can preventDefault)
    useEffect(() => {
        if (!isMobile) return;

        let sw: { startX: number; startY: number; startTime: number; locked: 'h' | 'v' | null; active: boolean } | null = null;

        const onStart = (e: TouchEvent) => {
            if (!isChatActiveRef.current || isAnimatingRef.current) return;
            const t = e.touches[0];
            sw = { startX: t.clientX, startY: t.clientY, startTime: Date.now(), locked: null, active: false };
        };

        const onMove = (e: TouchEvent) => {
            if (!sw || !isChatActiveRef.current) return;
            const t = e.touches[0];
            const dx = t.clientX - sw.startX;
            const dy = t.clientY - sw.startY;

            if (!sw.locked) {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                sw.locked = (Math.abs(dx) > Math.abs(dy) && dx > 0) ? 'h' : 'v';
            }
            if (sw.locked !== 'h') return;

            e.preventDefault();
            sw.active = true;

            const w = window.innerWidth;
            const pct = Math.max(0, Math.min(dx, w)) / w * 100;
            const sidebar = sidebarPanelRef.current;
            const chat = chatPanelRef.current;
            if (sidebar) { sidebar.style.transition = 'none'; sidebar.style.transform = `translateX(${pct - 100}%)`; }
            if (chat)    { chat.style.transition = 'none';    chat.style.transform    = `translateX(${pct}%)`; }
        };

        const onEnd = (e: TouchEvent) => {
            if (!sw?.active) { sw = null; return; }
            const t = e.changedTouches[0];
            const dx = t.clientX - sw.startX;
            const dt = Math.max(1, Date.now() - sw.startTime);
            const velocity = dx / dt; // px/ms
            const pct = dx / window.innerWidth;
            sw = null;

            if (pct > 0.35 || velocity > 0.5) {
                animateMobileBack();
            } else {
                // Snap back to chat
                const sidebar = sidebarPanelRef.current;
                const chat = chatPanelRef.current;
                const tr = 'transform 0.25s cubic-bezier(0.4,0,0.2,1)';
                if (sidebar) { sidebar.style.transition = tr; sidebar.style.transform = 'translateX(-100%)'; }
                if (chat)    { chat.style.transition    = tr; chat.style.transform    = 'translateX(0)'; }
                chat?.addEventListener('transitionend', () => {
                    if (sidebar) sidebar.style.cssText = '';
                    if (chat)    chat.style.cssText    = '';
                }, { once: true });
            }
        };

        document.addEventListener('touchstart', onStart, { passive: true });
        document.addEventListener('touchmove',  onMove,  { passive: false });
        document.addEventListener('touchend',   onEnd,   { passive: true });
        return () => {
            document.removeEventListener('touchstart', onStart);
            document.removeEventListener('touchmove',  onMove);
            document.removeEventListener('touchend',   onEnd);
        };
    }, [isMobile, animateMobileBack]);

    // Keep --mobile-vvh in sync with the visual viewport (accounts for keyboard height on iOS/Android).
    // Also preserves scroll position relative to the bottom when keyboard opens/closes.
    useEffect(() => {
        if (!isMobile) return;

        const update = () => {
            const newH = window.visualViewport?.height ?? window.innerHeight;
            const prevH = parseFloat(
                document.documentElement.style.getPropertyValue('--mobile-vvh') || '0'
            );

            // Capture distance-from-bottom before the layout changes
            const chatMessages = document.querySelector('.chat-messages') as HTMLElement | null;
            const distFromBottom = chatMessages
                ? chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight
                : 0;

            document.documentElement.style.setProperty('--mobile-vvh', `${newH}px`);

            // After the browser has reflowed, restore the same distance-from-bottom
            if (prevH > 0 && newH !== prevH && chatMessages) {
                requestAnimationFrame(() => {
                    chatMessages.scrollTop =
                        chatMessages.scrollHeight - chatMessages.clientHeight - distFromBottom;
                });
            }
        };

        // Prevent iOS Safari from scrolling the layout viewport when keyboard appears
        const preventScroll = () => window.scrollTo(0, 0);

        update();
        window.visualViewport?.addEventListener('resize', update);
        window.visualViewport?.addEventListener('scroll', preventScroll);
        return () => {
            window.visualViewport?.removeEventListener('resize', update);
            window.visualViewport?.removeEventListener('scroll', preventScroll);
            document.documentElement.style.removeProperty('--mobile-vvh');
        };
    }, [isMobile]);

    const reloadChats = async () => {
        const res = await authFetch(`${API_URL}/chat/my`);

        if (!res || !res.ok) return;

        const data: Array<Omit<ChatListItem, "unreadCount"> & { unreadCount?: number | null }> =
            await res.json();
        const normalized: ChatListItem[] = data.map((c) => ({
            ...c,
            unreadCount: c.unreadCount ?? 0,
        }));
        normalized.forEach(c => {
            if (c.lastMessageCreatedAt) {
                lastMessageTimestampRef.current.set(c.chatId, c.lastMessageCreatedAt);
            }
        });
        setChats([...normalized].sort(sortChats));
    };

    useEffect(() => {
        localStorage.setItem("sidebarWidth", String(sidebarWidth));
    }, [sidebarWidth]);

    useEffect(() => {
        reloadChats();
        authFetch(`${API_URL}/users/me`)
            .then(r => r?.ok ? r.json() : null)
            .then(d => { if (d) setCurrentUser({ id: d.id, avatarUrl: d.avatarUrl ?? null }); })
            .catch(() => {});
    }, []);

    // Re-fetch sidebar when user returns to the tab.
    // Catches any messages/events that arrived while WS was disconnected.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                document.title = "Synk.";
                reloadChats();
            }
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            const chatId = (e as CustomEvent<number>).detail;
            setChats(prev => prev.filter(c => c.chatId !== chatId));
        };
        window.addEventListener("chat-left", handler);
        return () => window.removeEventListener("chat-left", handler);
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            const { chatId, avatarUrl } = (e as CustomEvent<ChatAvatarUpdatedDetail>).detail;
            setChats(prev => prev.map(chat =>
                chat.chatId === chatId
                    ? { ...chat, chatAvatarUrl: avatarUrl }
                    : chat
            ));
        };
        window.addEventListener("chat-avatar-updated", handler);
        return () => window.removeEventListener("chat-avatar-updated", handler);
    }, []);

    useEffect(() => {
        if (!client) return;

        const subscription = client.subscribe(
            "/user/queue/chat-updates",
            async (msg) => {
                const body = JSON.parse(msg.body);

                if (body.type === "DELETED") {
                    setChats(prev => prev.filter(c => c.chatId !== body.chatId));
                    if (String(body.chatId) === activeChatIdRef.current) {
                        navigate("/chat");
                    }
                    return;
                }

                if (body.type === "CONTENT" && body.unreadCount > 0) {
                    const prevTs = lastMessageTimestampRef.current.get(body.chatId);
                    const newTs = body.lastMessageCreatedAt;
                    const isNewMessage = newTs && newTs !== prevTs && (!prevTs || newTs > prevTs);

                    if (isNewMessage && !recentNotificationsRef.current.has(body.chatId)) {
                        recentNotificationsRef.current.add(body.chatId);
                        setTimeout(() => recentNotificationsRef.current.delete(body.chatId), 500);
                        if (!muteSound) notificationSoundRef.current?.play().catch(() => {});
                        navigator.vibrate?.(150);
                        if (document.visibilityState !== "visible") {
                            document.title = "You have new messages - Synk.";
                        }
                    }
                }
                if (body.lastMessageCreatedAt) {
                    lastMessageTimestampRef.current.set(body.chatId, body.lastMessageCreatedAt);
                }

                setChats(prev => {
                    const exists = prev.some(chat => chat.chatId === body.chatId);

                    if (!exists) {
                        reloadChats();
                        return prev;
                    }

                    const updated = prev.map(chat => {
                        if (chat.chatId !== body.chatId) return chat;
                        if (body.type === "READ_ACK") {
                            return {
                                ...chat,
                                ...(body.unreadCount != null ? { unreadCount: body.unreadCount } : {}),
                                ...(body.peerLastReadMessageId != null ? { peerLastReadMessageId: body.peerLastReadMessageId } : {}),
                            };
                        }
                        return {
                            ...chat,
                            ...("chatAvatarUrl" in body ? { chatAvatarUrl: body.chatAvatarUrl ?? null } : {}),
                            lastMessageContent: body.lastMessageContent ?? null,
                            lastMessageSender: body.lastMessageSender ?? null,
                            lastMessageCreatedAt: body.lastMessageCreatedAt ?? chat.lastMessageCreatedAt,
                            unreadCount: body.unreadCount ?? 0,
                            lastMessageId: body.lastMessageId ?? chat.lastMessageId,
                        };
                    });

                    return [...updated].sort(sortChats);
                });

                if ("chatAvatarUrl" in body) {
                    window.dispatchEvent(new CustomEvent<ChatAvatarUpdatedDetail>("chat-avatar-updated", {
                        detail: {
                            chatId: body.chatId,
                            avatarUrl: body.chatAvatarUrl ?? null,
                        },
                    }));
                }
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

    const getSidebarTypingLabel = (chat: ChatListItem): string | null => {
        const users = typingByChatId[String(chat.chatId)];
        if (!users || users.length === 0) return null;
        if (chat.type === "PRIVATE") return t("sidebar.typing");
        if (users.length === 1) return t("sidebar.typingOne", { user: users[0] });
        if (users.length === 2) return t("sidebar.typingTwo", { user1: users[0], user2: users[1] });
        return t("sidebar.typingMany", { user1: users[0], user2: users[1], count: users.length - 2 });
    };

    const getLastMessagePreview = (chat: ChatListItem): string => {
        if (!chat.lastMessageContent && chat.lastMessageContent !== "") return t("sidebar.noMessages");
        const isVoice = chat.lastMessageContent === "🎤 Voice message";
        const content = isVoice ? t("message.voice") : formatSystemContent(chat.lastMessageContent);
        const sender = chat.lastMessageSender;
        if (chat.type === "GROUP" && sender && sender !== currentUsername) {
            return `${sender}: ${content}`;
        }
        return content ?? t("sidebar.noMessages");
    };

    const showReadDot = (chat: ChatListItem): boolean => {
        if (chat.lastMessageSender !== currentUsername) return false;
        if (chat.lastMessageId == null) return false;
        return chat.peerLastReadMessageId == null || chat.peerLastReadMessageId < chat.lastMessageId;
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

    useEffect(() => {
        if (!chatContextMenu) return;
        const close = () => setChatContextMenu(null);
        document.addEventListener("mousedown", close);
        document.addEventListener("touchstart", close);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("touchstart", close);
        };
    }, [chatContextMenu]);

    // Long press on chat tiles
    const pendingChatId = useRef<number | null>(null);
    const chatTileLongPress = useLongPress(
        useCallback((x: number, y: number) => {
            if (pendingChatId.current === null) return;
            const chat = chats.find(c => c.chatId === pendingChatId.current);
            if (!chat) return;
            const cx = Math.min(x, window.innerWidth - 160);
            setChatContextMenu({ chatId: chat.chatId, isPinned: chat.pinnedAt != null, x: cx, y });
        }, [chats])
    );

    const handlePinChat = async (chatIdToPin: number, isCurrentlyPinned: boolean) => {
        const method = isCurrentlyPinned ? "DELETE" : "POST";
        const res = await authFetch(`${API_URL}/chat/${chatIdToPin}/pin`, { method });
        if (!res || !res.ok) return;
        const pinnedAt = isCurrentlyPinned ? null : new Date().toISOString();
        setChats(prev =>
            prev.map(c => c.chatId === chatIdToPin ? { ...c, pinnedAt } : c).sort(sortChats)
        );
        setChatContextMenu(null);
    };

    const handleDeleteChat = async (chatIdToDelete: number) => {
        const res = await authFetch(`${API_URL}/chat/${chatIdToDelete}`, { method: "DELETE" });
        if (!res || !res.ok) return;
        setChats(prev => prev.filter(c => c.chatId !== chatIdToDelete));
        setDeleteChatConfirm(null);
        if (String(chatIdToDelete) === activeChatIdRef.current) {
            navigate("/chat");
        }
    };

    const handleLogout = async () => {
        console.log("IM LOGOUT");
        try {
            console.log("TRY");
            await unsubscribePush();
            console.log("UNSUB");
            const token = localStorage.getItem("accessToken");
            await fetch(`${API_URL}/api/auth/logout`, {
                method: "POST",
                credentials: "include",
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log("SUCCESS");
        } catch {
            console.log("CATCH");
            // ignore — always clean up
        } finally {
            localStorage.removeItem("accessToken");
            window.location.href = "/login";
            console.log("FINALLY");
        }
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

    const sidebarJSX = (
        <div className="sidebar" style={isMobile ? undefined : { width: sidebarWidth }}>

            {/* ── Header ── */}
            <div className="sidebar-header">
                <div className="sidebar-header-left">
                    <button className="sidebar-profile-btn" onClick={() => currentUser && navigate(`/user/${currentUser.id}`)}>
                        <div className="sidebar-avatar-sm">
                            {currentUser?.avatarUrl
                                ? <img src={currentUser.avatarUrl} className="sidebar-avatar-img" alt="" />
                                : currentUsername.charAt(0).toUpperCase()}
                        </div>
                    </button>
                </div>

                <div className="sidebar-logo" role="img" aria-label="Synk" />

                <div className="sidebar-header-right">
                    <button className="sidebar-create-btn" onClick={() => navigate("/group")}>
                        <img src="/icons/people.png" alt="create group" />
                    </button>
                </div>
            </div>

            {/* ── Search (chats tab only) ── */}
            {activeTab === "chats" && (
                <>
                    <div className="sidebar-search-wrapper">
                        <input
                            className="sidebar-search-input"
                            placeholder={t("sidebar.search")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="sidebar-divider" />
                </>
            )}

            {/* ── Dynamic content ── */}
            <div className="sidebar-main-content">

                {/* Chats tab */}
                {activeTab === "chats" && (
                    <div className="chat-list-wrapper">
                        {!searchQuery.trim() ? (
                            <div className="chat-list">
                                {chats.length === 0 && (
                                    <div className="chat-list-empty">
                                        {t("sidebar.noChats")}
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
                                            onClick={(e) => {
                                                chatTileLongPress.onClick(e);
                                                if (!e.defaultPrevented) navigate(`/chat/${chat.chatId}`);
                                            }}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                setChatContextMenu({ chatId: chat.chatId, isPinned: chat.pinnedAt != null, x: Math.min(e.clientX, window.innerWidth - 160), y: e.clientY });
                                            }}
                                            onTouchStart={(e) => { pendingChatId.current = chat.chatId; chatTileLongPress.onTouchStart(e); }}
                                            onTouchMove={chatTileLongPress.onTouchMove}
                                            onTouchEnd={chatTileLongPress.onTouchEnd}
                                            onTouchCancel={chatTileLongPress.onTouchCancel}
                                        >
                                            <div className="chat-avatar-wrap">
                                                <div className="chat-avatar">
                                                    {chat.chatAvatarUrl
                                                        ? <img src={chat.chatAvatarUrl} className="chat-avatar-img" alt="" />
                                                        : chat.displayName.charAt(0).toUpperCase()}
                                                </div>
                                                {chat.type === "PRIVATE" && isOnline(chat.partnerUsername ?? chat.displayName) && (
                                                    <span className="presence-dot" />
                                                )}
                                            </div>

                                            <div className="chat-info">
                                                <div className="chat-top">
                                                    <div className={`chat-display-name ${chat.unreadCount > 0 ? "unread" : ""}`}>
                                                        {chat.displayName}
                                                    </div>

                                                    <div className="chat-tile-meta">
                                                        {chat.pinnedAt && (
                                                            <img src="/icons/pin.png" className="chat-pin-icon" alt="" />
                                                        )}
                                                        <div className="chat-time">{formattedTime}</div>

                                                        {showReadDot(chat) && (
                                                            <span className="read-dot" />
                                                        )}

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
                                                        {getLastMessagePreview(chat)}
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
                                        <div className="search-section-label">{t("nav.chats")}</div>
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
                                                        onClick={(e) => {
                                                            chatTileLongPress.onClick(e);
                                                            if (!e.defaultPrevented) navigate(`/chat/${chat.chatId}`);
                                                        }}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            setChatContextMenu({ chatId: chat.chatId, isPinned: chat.pinnedAt != null, x: Math.min(e.clientX, window.innerWidth - 160), y: e.clientY });
                                                        }}
                                                        onTouchStart={(e) => { pendingChatId.current = chat.chatId; chatTileLongPress.onTouchStart(e); }}
                                                        onTouchMove={chatTileLongPress.onTouchMove}
                                                        onTouchEnd={chatTileLongPress.onTouchEnd}
                                                        onTouchCancel={chatTileLongPress.onTouchCancel}
                                                    >
                                                        <div className="chat-avatar-wrap">
                                                            <div className="chat-avatar">
                                                                {chat.chatAvatarUrl
                                                                    ? <img src={chat.chatAvatarUrl} className="chat-avatar-img" alt="" />
                                                                    : chat.displayName.charAt(0).toUpperCase()}
                                                            </div>
                                                            {chat.type === "PRIVATE" && isOnline(chat.partnerUsername ?? chat.displayName) && (
                                                                <span className="presence-dot" />
                                                            )}
                                                        </div>

                                                        <div className="chat-info">
                                                            <div className="chat-top">
                                                                <div className={`chat-display-name ${chat.unreadCount > 0 ? "unread" : ""}`}>
                                                                    {chat.displayName}
                                                                </div>

                                                                <div className="chat-tile-meta">
                                                                    <div className="chat-time">{formattedTime}</div>

                                                                    {showReadDot(chat) && (
                                                                        <span className="read-dot" />
                                                                    )}

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
                                                                    {formatSystemContent(chat.lastMessageContent) ?? t("sidebar.noMessages")}
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
                                    <div className="search-section-label">{t("sidebar.people")}</div>

                                    {searchResults.length === 0 ? (
                                        <div className="search-section-empty">{t("sidebar.noPeopleFound")}</div>
                                    ) : (
                                        searchResults.map((user) => (
                                            <div
                                                key={user.id}
                                                className="search-person-tile fade-item"
                                                onClick={() => navigate(`/user/${user.id}`)}
                                            >
                                                <div className="search-person-avatar">
                                                    {user.avatarUrl
                                                        ? <img src={user.avatarUrl} className="chat-avatar-img" alt="" />
                                                        : (user.displayName ?? user.username).charAt(0).toUpperCase()}
                                                </div>
                                                <div className="search-person-info">
                                                    <span className="search-person-name">
                                                        {user.displayName ?? user.username}
                                                    </span>
                                                    {user.displayName && (
                                                        <span className="search-person-username">@{user.username}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Settings tab */}
                {activeTab === "settings" && (
                    <div className="sidebar-settings">
                        <div className="settings-section">
                            <div className="settings-row" onClick={toggleTheme}>
                                <span className="settings-row-label">{t("settings.lightTheme")}</span>
                                <button
                                    className={`settings-theme-toggle ${theme === "light" ? "on" : "off"}`}
                                    onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                                >
                                    <span className="settings-toggle-knob" />
                                </button>
                            </div>
                            <div className="settings-row" onClick={toggleMuteSound}>
                                <span className="settings-row-label">{t("settings.muteSound")}</span>
                                <button
                                    className={`settings-theme-toggle ${muteSound ? "on" : "off"}`}
                                    onClick={(e) => { e.stopPropagation(); toggleMuteSound(); }}
                                >
                                    <span className="settings-toggle-knob" />
                                </button>
                            </div>
                            <div className="settings-row" onClick={() => setLang(lang === "ru" ? "en" : "ru")}>
                                <span className="settings-row-label">{t("settings.language")}</span>
                                <button
                                    className={`settings-lang-toggle ${lang === "en" ? "en" : ""}`}
                                    onClick={(e) => { e.stopPropagation(); setLang(lang === "ru" ? "en" : "ru"); }}
                                >
                                    <span className={`settings-lang-label${lang === "ru" ? " active" : ""}`}>RU</span>
                                    <span className={`settings-lang-label${lang === "en" ? " active" : ""}`}>EN</span>
                                    <span className="settings-lang-knob" />
                                </button>
                            </div>
                        </div>

                        <div className="settings-logout-area">
                            <button
                                className="settings-logout-btn"
                                onClick={() => setShowLogoutPopup(true)}
                            >
                                <img src="/icons/log-out.png" alt="" className="settings-logout-icon" />
                                {t("settings.logout")}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bottom navigation ── */}
            <div className="sidebar-bottom-nav">
                <div
                    className={`sidebar-nav-btn ${activeTab === "chats" ? "active" : ""}`}
                    onClick={() => setActiveTab("chats")}
                    title={t("nav.chats")}
                >
                    <span className="sidebar-nav-icon sidebar-nav-icon--chats" />
                </div>

                <div
                    className={`sidebar-nav-btn ${activeTab === "settings" ? "active" : ""}`}
                    onClick={() => setActiveTab("settings")}
                    title={t("nav.settings")}
                >
                    <span className="sidebar-nav-icon sidebar-nav-icon--settings" />
                </div>
            </div>

            {/* ── Logout popup ── */}
            {showLogoutPopup && (
                <div className="logout-popup-overlay">
                    <div className="logout-popup">
                        <div className="logout-title">{t("logout.title")}</div>

                        <div className="logout-subtitle">
                            {t("logout.subtitle")}
                        </div>

                        <div className="logout-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowLogoutPopup(false)}
                            >
                                {t("logout.cancel")}
                            </button>

                            <button
                                className="logout-confirm-btn"
                                onClick={handleLogout}
                            >
                                {t("logout.confirm")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Chat context menu ── */}
            {chatContextMenu && (
                <div
                    className="message-context-menu"
                    style={{ left: chatContextMenu.x, top: chatContextMenu.y }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    <button
                        className="context-menu-item"
                        onClick={() => handlePinChat(chatContextMenu.chatId, chatContextMenu.isPinned)}
                    >
                        {chatContextMenu.isPinned ? t("menu.unpin") : t("menu.pin")}
                    </button>
                    <button
                        className="context-menu-item danger"
                        onClick={() => {
                            setDeleteChatConfirm(chatContextMenu.chatId);
                            setChatContextMenu(null);
                        }}
                    >
                        {t("menu.delete")}
                    </button>
                </div>
            )}

            {/* ── Delete chat confirmation popup ── */}
            {deleteChatConfirm !== null && (
                <div className="logout-popup-overlay" onClick={() => setDeleteChatConfirm(null)}>
                    <div className="logout-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="logout-title">{t("deleteChat.title")}</div>
                        <div className="logout-subtitle">
                            {t("deleteChat.subtitle")}
                        </div>
                        <div className="logout-actions">
                            <button className="btn-secondary" onClick={() => setDeleteChatConfirm(null)}>
                                {t("deleteChat.cancel")}
                            </button>
                            <button
                                className="logout-confirm-btn"
                                onClick={() => handleDeleteChat(deleteChatConfirm)}
                            >
                                {t("deleteChat.confirm")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resizer: desktop only */}
            {!isMobile && (
                <div
                    className="sidebar-resizer"
                    onMouseDown={() => setIsResizing(true)}
                />
            )}
        </div>
    );

    if (isMobile) {
        return (
            <AppLayoutContext.Provider value={{ setRightPanel: setRightPanelStable, showLogout: () => setShowLogoutPopup(true) }}>
                <div className={`mobile-layout ${(chatId || userId || groupMatch) ? "chat-active" : "list-active"}`}>
                    <div className="mobile-sidebar-panel" ref={sidebarPanelRef}>
                        {sidebarJSX}
                    </div>
                    <div className="mobile-chat-panel" ref={chatPanelRef}>
                        <div className="content">
                            <Outlet />
                        </div>
                        {rightPanel}
                    </div>
                </div>
            </AppLayoutContext.Provider>
        );
    }

    // Desktop layout
    return (
        <AppLayoutContext.Provider value={{ setRightPanel: setRightPanelStable, showLogout: () => setShowLogoutPopup(true) }}>
            <div className="app-layout">
                {sidebarJSX}
                <div className="content">
                    <Outlet />
                </div>
                {rightPanel}
            </div>
        </AppLayoutContext.Provider>
    );
}
