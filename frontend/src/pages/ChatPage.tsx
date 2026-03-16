import { useEffect, useRef, useState } from "react";
import AppLayout from "../components/AppLayout";
import { authFetch } from "../utils/authFetch";
import { useNavigate, useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useWebSocket } from "../context/WebSocketContext";
import { usePresence } from "../context/PresenceContext";
import { API_URL } from "../config";
import type {
    AttachmentDto,
    ChatParticipant,
    JwtPayload,
    Message,
    PendingFile,
    ReadAckEvent,
    UploadingBubble,
} from "./chat/chatTypes";
import { groupMessagesByDateAndSender } from "./chat/groupMessages";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatInfoPanel } from "./chat/ChatInfoPanel";
import { TypingIndicator } from "./chat/TypingIndicator";
import { AttachmentsBar } from "./chat/AttachmentsBar";
import { MessageContextMenu, type MessageContextMenuState } from "./chat/MessageContextMenu";
import { MessageList } from "./chat/MessageList";
import { ImageViewer } from "./chat/ImageViewer";
import { ReplyBar, EditBar } from "./chat/ReplyEditBars";
import { ScrollToBottomButton } from "./chat/ScrollToBottomButton";

export default function ChatPage() {
    const { chatId } = useParams();
    const numericChatId = chatId ? Number(chatId) : null;

    const [messages, setMessages] = useState<Message[]>([]);
    const navigate = useNavigate();
    const [chatName, setChatName] = useState<string>("");
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [chatType, setChatType] = useState<string | null>(null);
    const [input, setInput] = useState("");
    const [hasMoreOlder, setHasMoreOlder] = useState(false);
    const [hasMoreNewer, setHasMoreNewer] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [contextMenu, setContextMenu] = useState<MessageContextMenuState | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingOriginalContent, setEditingOriginalContent] = useState("");
    const [deletingMessageIds, setDeletingMessageIds] = useState<Set<number>>(new Set());
    // Tracks ids that are already mid-collapse so the WS echo doesn't double-animate
    const animatingDeleteIdsRef = useRef<Set<number>>(new Set());

    // undefined = not yet determined from /chat/my, null = no previous read, number = last read id
    const [initialLastReadMessageId, setInitialLastReadMessageId] = useState<number | null | undefined>(undefined);
    // undefined = not yet set, null = no divider needed, number = first unread message id
    const [unreadDividerMessageId, setUnreadDividerMessageId] = useState<number | null | undefined>(undefined);
    const dividerDeterminedRef = useRef(false);
    const dividerRef = useRef<HTMLDivElement | null>(null);
    const initialScrollDoneRef = useRef(false);
    // Ref mirror of hasMoreNewer to avoid stale closure in WS subscription callback
    const hasMoreNewerRef = useRef(false);
    // When navigating to a reply target, holds the message id to scroll to after render
    const pendingScrollToMessageIdRef = useRef<number | null>(null);

    // other participants' read state: username -> lastReadMessageId
    const [otherParticipantsReadMap, setOtherParticipantsReadMap] = useState<Record<string, number>>({});

    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [uploadingBubbles, setUploadingBubbles] = useState<UploadingBubble[]>([]);
    const [viewerState, setViewerState] = useState<{
        photos: AttachmentDto[];
        index: number;
        sender: string;
        createdAt: string;
    } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const COLLAPSE_MS = 320;
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const oldestIdRef = useRef<number | null>(null);
    const newestIdRef = useRef<number | null>(null);
    const shouldScrollToBottom = useRef(false);
    const shouldRestoreScroll = useRef(false);
    const savedScrollHeight = useRef(0);
    const isAtBottomRef = useRef(true);
    const markAsReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const client = useWebSocket();
    const { isOnline } = usePresence();

    const triggerMarkAsRead = () => {
        if (!numericChatId) return;
        if (document.visibilityState !== "visible") return;
        if (markAsReadTimeoutRef.current) clearTimeout(markAsReadTimeoutRef.current);
        markAsReadTimeoutRef.current = setTimeout(() => {
            authFetch(`${API_URL}/chat/${numericChatId}/read`, { method: "POST" });
            markAsReadTimeoutRef.current = null;
        }, 300);
    };

    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const typingTimersRef = useRef<{ [u: string]: ReturnType<typeof setTimeout> }>({});
    const typingSentRef = useRef(false);
    const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const uploadingBubbleTempIdRef = useRef<string | null>(null);
    const sentAtNewestIdRef = useRef<number | null>(null);

    // Remove the uploading bubble once the server echo appears in `messages`.
    // We can't do this inside the WS subscription callback because React 18 batches
    // pending progress-update setState calls, which prevents the eager-state optimization
    // from running the setMessages updater synchronously (so appearedAsNew stays false).
    // A useEffect on `messages` is guaranteed to run after the render that includes the echo.
    useEffect(() => {
        const tid = uploadingBubbleTempIdRef.current;
        if (!tid) return;
        const watermark = sentAtNewestIdRef.current;
        const lastMsg = messages[messages.length - 1];
        if (
            lastMsg &&
            lastMsg.sender === currentUsername &&
            !lastMsg.deletedAt &&
            (watermark === null || lastMsg.id > watermark)
        ) {
            uploadingBubbleTempIdRef.current = null;
            sentAtNewestIdRef.current = null;
            setUploadingBubbles([]);
        }
    }, [messages]);

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
        let cancelled = false;

        type MyChatItem = {
            chatId: number;
            displayName: string;
            type: string;
            lastReadMessageId: number | null;
        };

        const loadChatInfo = async () => {
            const res = await authFetch(`${API_URL}/chat/my`);
            if (cancelled || !res || !res.ok) return;

            const data: MyChatItem[] = await res.json();
            if (cancelled) return;

            const currentChat = data.find((c) => c.chatId === numericChatId);
            if (currentChat) {
                setChatName(currentChat.displayName);
                setChatType(currentChat.type);
                setInitialLastReadMessageId(currentChat.lastReadMessageId ?? null);
            }
        };

        loadChatInfo();
        return () => { cancelled = true; };
    }, [numericChatId]);

    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 150);
        return () => clearTimeout(t);
    }, [numericChatId]);

    useEffect(() => {
        if (!numericChatId) return;

        setMessages([]);
        setHasMoreOlder(false);
        setHasMoreNewer(false);
        hasMoreNewerRef.current = false;
        oldestIdRef.current = null;
        newestIdRef.current = null;
        shouldScrollToBottom.current = false;
        isAtBottomRef.current = true;
        dividerDeterminedRef.current = false;
        initialScrollDoneRef.current = false;
        if (markAsReadTimeoutRef.current) {
            clearTimeout(markAsReadTimeoutRef.current);
            markAsReadTimeoutRef.current = null;
        }
        setUnreadDividerMessageId(undefined);
        setInitialLastReadMessageId(undefined);
        setOtherParticipantsReadMap({});
        setPendingFiles([]);
        setUploadingBubbles([]);
        setViewerState(null);
    }, [numericChatId]);

    // When the tab becomes visible again, mark messages as read if we're at the bottom
    useEffect(() => {
        const handleVisible = () => {
            if (document.visibilityState === "visible" && isAtBottomRef.current) {
                triggerMarkAsRead();
            }
        };
        document.addEventListener("visibilitychange", handleVisible);
        return () => document.removeEventListener("visibilitychange", handleVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numericChatId]);

    // Load initial messages once chat info is ready. If the user has a lastReadMessageId,
    // load a window around that boundary (?around=). Otherwise load the latest page.
    useEffect(() => {
        if (!numericChatId) return;
        if (initialLastReadMessageId === undefined) return; // wait for chat info
        let cancelled = false;

        const loadMessages = async () => {
            const url = initialLastReadMessageId !== null
                ? `${API_URL}/messages/${numericChatId}?around=${initialLastReadMessageId}`
                : `${API_URL}/messages/${numericChatId}`;

            const res = await authFetch(url);
            if (cancelled || !res || !res.ok) return;

            const data = await res.json();
            if (cancelled) return;

            const visible = data.messages.filter((m: Message) => !m.deletedAt);
            setMessages(visible);
            setHasMoreOlder(data.hasMoreOlder);
            setHasMoreNewer(data.hasMoreNewer);
            hasMoreNewerRef.current = data.hasMoreNewer;
            if (visible.length > 0) {
                oldestIdRef.current = visible[0].id;
                newestIdRef.current = visible[visible.length - 1].id;
            }
        };

        loadMessages();
        return () => { cancelled = true; };
    }, [numericChatId, initialLastReadMessageId]);

    // Determine divider position once. The ?around= query already loads a window
    // centered on the boundary, so no silent pagination is needed.
    useEffect(() => {
        if (dividerDeterminedRef.current) return;
        if (initialLastReadMessageId === undefined) return;
        if (messages.length === 0) return;

        dividerDeterminedRef.current = true;
        const firstUnread = messages.find(
            m => m.id > (initialLastReadMessageId ?? -1) && m.sender !== currentUsername
        );
        setUnreadDividerMessageId(firstUnread?.id ?? null);
    }, [messages, initialLastReadMessageId]);

    // Keep hasMoreNewerRef in sync so WS subscription callback always has a fresh value.
    useEffect(() => {
        hasMoreNewerRef.current = hasMoreNewer;
    }, [hasMoreNewer]);

    // After the divider position is determined, scroll to it (or to bottom if no divider).
    // Runs once per chat open via initialScrollDoneRef.
    useEffect(() => {
        if (initialScrollDoneRef.current) return;
        if (unreadDividerMessageId === undefined) return;
        if (messages.length === 0) return;
        initialScrollDoneRef.current = true;
        const container = chatContainerRef.current;
        if (!container) return;
        if (unreadDividerMessageId === null) {
            container.scrollTop = container.scrollHeight;
            isAtBottomRef.current = true;
            if (!hasMoreNewerRef.current) triggerMarkAsRead();
        } else {
            requestAnimationFrame(() => {
                const divider = dividerRef.current;
                if (divider) {
                    const containerTop = container.getBoundingClientRect().top;
                    const dividerTop = divider.getBoundingClientRect().top;
                    container.scrollTop += dividerTop - containerTop;
                } else {
                    container.scrollTop = container.scrollHeight;
                    isAtBottomRef.current = true;
                    if (!hasMoreNewerRef.current) triggerMarkAsRead();
                }
            });
        }
    }, [unreadDividerMessageId, messages]);

    const loadOlderMessages = async () => {
        if (!hasMoreOlder || isLoadingMore || !numericChatId || oldestIdRef.current === null) return;

        setIsLoadingMore(true);
        savedScrollHeight.current = chatContainerRef.current?.scrollHeight ?? 0;
        shouldScrollToBottom.current = false;
        shouldRestoreScroll.current = true;

        const res = await authFetch(`${API_URL}/messages/${numericChatId}?before=${oldestIdRef.current}`);

        if (!res || !res.ok) {
            setIsLoadingMore(false);
            return;
        }

        const data = await res.json();
        const visible = data.messages.filter((m: Message) => !m.deletedAt);
        setMessages(prev => [...visible, ...prev]);
        setHasMoreOlder(data.hasMoreOlder);
        if (visible.length > 0) oldestIdRef.current = visible[0].id;
        setIsLoadingMore(false);
    };

    const loadNewerMessages = async () => {
        if (!hasMoreNewer || isLoadingMore || !numericChatId || newestIdRef.current === null) return;

        setIsLoadingMore(true);

        const res = await authFetch(`${API_URL}/messages/${numericChatId}?after=${newestIdRef.current}`);

        if (!res || !res.ok) {
            setIsLoadingMore(false);
            return;
        }

        const data = await res.json();
        const visible = data.messages.filter((m: Message) => !m.deletedAt);
        setMessages(prev => [...prev, ...visible]);
        setHasMoreNewer(data.hasMoreNewer);
        hasMoreNewerRef.current = data.hasMoreNewer;
        if (visible.length > 0) newestIdRef.current = visible[visible.length - 1].id;
        setIsLoadingMore(false);
    };

    useEffect(() => {
        if (!client || !numericChatId) return;

        const subscription = client.subscribe(`/topic/chat.${numericChatId}`, (msg: { body: string }) => {
                const body: Message = JSON.parse(msg.body);
                let appearedAsNew = false;
                let shouldAnimateDelete = false;
                setMessages(prev => {
                    const idx = prev.findIndex(m => m.id === body.id);
                    if (idx === -1) {
                        if (body.deletedAt) return prev;
                        // In windowed mode (not at the live edge), don't append new messages —
                        // they'd create a gap. User will see them after jumping/scrolling to bottom.
                        if (hasMoreNewerRef.current) return prev;
                        appearedAsNew = true;
                        if (isAtBottomRef.current) {
                            shouldScrollToBottom.current = true;
                        }
                        return [...prev, body];
                    }
                    // Existing message deleted: trigger collapse animation instead of instant removal
                    if (body.deletedAt) {
                        shouldAnimateDelete = true;
                        return prev; // animation callback will remove it after COLLAPSE_MS
                    }
                    const next = [...prev];
                    next[idx] = body;
                    return next;
                });
                if (appearedAsNew && isAtBottomRef.current) {
                    triggerMarkAsRead();
                }
                if (shouldAnimateDelete) {
                    startCollapseAnimation(body.id);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [client, numericChatId]);

    useEffect(() => {
        if (!client || !numericChatId) return;

        const subscription = client.subscribe(`/topic/chat.${numericChatId}.read`, (msg: { body: string }) => {
                const body: ReadAckEvent = JSON.parse(msg.body);
                if (body.readerUsername === currentUsername) return;
                setOtherParticipantsReadMap(prev => ({
                    ...prev,
                    [body.readerUsername]: body.lastReadMessageId,
                }));
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [client, numericChatId, currentUsername]);

    useEffect(() => {
        if (!client || !numericChatId) return;

        const subscription = client.subscribe(`/topic/chat.${numericChatId}.typing`, (msg: { body: string }) => {
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
        } else if (pendingScrollToMessageIdRef.current !== null) {
            const targetId = pendingScrollToMessageIdRef.current;
            pendingScrollToMessageIdRef.current = null;
            requestAnimationFrame(() => {
                const el = document.querySelector(`[data-message-id="${targetId}"]`);
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.classList.add("message-highlight");
                    setTimeout(() => el.classList.remove("message-highlight"), 1200);
                }
            });
        }
        // else: edit/delete — don't touch scroll position
    }, [messages]);

    useEffect(() => {
        if (!numericChatId) return;
        let cancelled = false;

        const loadParticipants = async () => {
            const res = await authFetch(`${API_URL}/chat/${numericChatId}/participants`);
            if (cancelled || !res || !res.ok) return;

            const data: ChatParticipant[] = await res.json();
            if (cancelled) return;

            setParticipants(data);

            const fetchedReadMap: Record<string, number> = {};
            for (const p of data) {
                if (p.username !== currentUsername && p.lastReadMessageId !== null) {
                    fetchedReadMap[p.username] = p.lastReadMessageId;
                }
            }
            // Merge: keep the maximum lastReadMessageId per participant so that
            // ReadAckEvents received via WebSocket before this fetch completes are
            // not overwritten by stale data from the HTTP response.
            setOtherParticipantsReadMap(prev => {
                const merged: Record<string, number> = { ...fetchedReadMap };
                for (const [username, liveLastRead] of Object.entries(prev)) {
                    if ((merged[username] ?? -1) < liveLastRead) {
                        merged[username] = liveLastRead;
                    }
                }
                return merged;
            });
        };

        loadParticipants();
        return () => { cancelled = true; };
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
            } else if (replyingTo !== null) {
                setReplyingTo(null);
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [contextMenu, editingMessageId, replyingTo]);

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

    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        return chunks;
    };

    const uploadFileWithProgress = (file: File, onProgress: (pct: number) => void): Promise<AttachmentDto | null> => {
        return new Promise((resolve) => {
            const formData = new FormData();
            formData.append("file", file);
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            });
            xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    resolve(null);
                }
            });
            xhr.addEventListener("error", () => resolve(null));
            const token = localStorage.getItem("accessToken");
            xhr.open("POST", `${API_URL}/attachments/upload`);
            if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            xhr.send(formData);
        });
    };

    const handleFilesSelected = (files: FileList | File[]) => {
        Promise.all(
            Array.from(files)
                .filter(f => f.type.startsWith("image/"))
                .map(async f => {
                    const previewUrl = URL.createObjectURL(f);
                    let naturalWidth = 280, naturalHeight = 200;
                    try {
                        const bm = await createImageBitmap(f);
                        naturalWidth = bm.width;
                        naturalHeight = bm.height;
                        bm.close();
                    } catch {}
                    return { localId: crypto.randomUUID(), file: f, previewUrl, naturalWidth, naturalHeight };
                })
        ).then(newFiles => setPendingFiles(prev => [...prev, ...newFiles]));
    };

    const sendMessage = async () => {
        const editingMessage = editingMessageId !== null ? messages.find(m => m.id === editingMessageId) : null;
        const editingHasAttachments = (editingMessage?.attachments?.length ?? 0) > 0;
        if (!input.trim() && pendingFiles.length === 0 && !editingHasAttachments) return;

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

        const filesToUpload = [...pendingFiles];
        const messageContent = input;
        const replyTarget = replyingTo;

        setReplyingTo(null);
        setPendingFiles([]);
        setInput("");

        if (filesToUpload.length > 0) {
            // Split files into chunks of 5; each chunk becomes its own message bubble
            const fileChunks = chunkArray(filesToUpload, 5);
            const firstTempId = crypto.randomUUID();
            uploadingBubbleTempIdRef.current = firstTempId;
            setUploadingBubbles(prev => [
                ...prev,
                ...fileChunks.map((chunk, i) => ({
                    tempId: i === 0 ? firstTempId : crypto.randomUUID(),
                    content: i === 0 ? messageContent : "",
                    replyPreview: i === 0 ? replyTarget?.replyPreview : undefined,
                    files: chunk,
                    progress: 0,
                })),
            ]);
            shouldScrollToBottom.current = true;
            isAtBottomRef.current = true;

            // Upload all files sequentially, tracking aggregate progress across all bubbles
            const attachmentIds: number[] = [];
            for (let i = 0; i < filesToUpload.length; i++) {
                const dto = await uploadFileWithProgress(filesToUpload[i].file, (pct) => {
                    const overall = Math.round((i * 100 + pct) / filesToUpload.length);
                    setUploadingBubbles(prev => prev.map(b => ({ ...b, progress: overall })));
                });
                if (dto) attachmentIds.push(dto.id);
            }

            const idChunks = chunkArray(attachmentIds, 5);
            sentAtNewestIdRef.current = newestIdRef.current;
            for (let i = 0; i < idChunks.length; i++) {
                client.publish({
                    destination: "/app/chat.send",
                    body: JSON.stringify({
                        chatId: numericChatId,
                        content: i === 0 ? messageContent : "",
                        ...(i === 0 && replyTarget ? { replyToMessageId: replyTarget.id } : {}),
                        attachmentIds: idChunks[i],
                    }),
                });
            }
        } else {
            client.publish({
                destination: "/app/chat.send",
                body: JSON.stringify({
                    chatId: numericChatId,
                    content: messageContent,
                    ...(replyTarget ? { replyToMessageId: replyTarget.id } : {}),
                }),
            });
        }

        if (hasMoreNewerRef.current) {
            // Windowed: reload latest page so the sent message is visible
            const res = await authFetch(`${API_URL}/messages/${numericChatId}`);
            if (res && res.ok) {
                const data = await res.json();
                const visible = data.messages.filter((m: Message) => !m.deletedAt);
                setMessages(visible);
                setUploadingBubbles([]);
                setHasMoreOlder(data.hasMoreOlder);
                setHasMoreNewer(false);
                hasMoreNewerRef.current = false;
                if (visible.length > 0) {
                    oldestIdRef.current = visible[0].id;
                    newestIdRef.current = visible[visible.length - 1].id;
                }
                shouldScrollToBottom.current = true;
                isAtBottomRef.current = true;
            }
        } else {
            isAtBottomRef.current = true;
        }
    };

    const getTypingText = (): string => {
        if (chatType === "PRIVATE") return "typing...";
        if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
        if (typingUsers.length === 2) return `${typingUsers[0]}, ${typingUsers[1]} are typing...`;
        return `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers.length - 2} other${typingUsers.length - 2 > 1 ? "s" : ""} are typing...`;
    };

    const handleMessageRightClick = (e: React.MouseEvent, msg: Message, isMine: boolean) => {
        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - 148);
        const y = Math.min(e.clientY, window.innerHeight - 160);
        setContextMenu({ x, y, messageId: msg.id, content: msg.content, sender: msg.sender, isMine });
    };

    const startCollapseAnimation = (messageId: number) => {
        if (animatingDeleteIdsRef.current.has(messageId)) return;
        animatingDeleteIdsRef.current.add(messageId);
        setDeletingMessageIds(ids => new Set([...ids, messageId]));
        setTimeout(() => {
            setMessages(m => m.filter(x => x.id !== messageId));
            setDeletingMessageIds(ids => {
                const n = new Set(ids);
                n.delete(messageId);
                return n;
            });
            animatingDeleteIdsRef.current.delete(messageId);
        }, COLLAPSE_MS);
    };

    const handleDeleteMessage = async () => {
        if (!contextMenu) return;
        const messageId = contextMenu.messageId;
        setContextMenu(null);
        startCollapseAnimation(messageId);
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

    const handleStartReply = () => {
        if (!contextMenu) return;
        const msg = messages.find(m => m.id === contextMenu.messageId);
        if (msg) setReplyingTo(msg);
        setContextMenu(null);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const cancelReply = () => setReplyingTo(null);

    const scrollToMessage = async (messageId: number) => {
        const isLoaded = messages.some(m => m.id === messageId);
        if (isLoaded) {
            const el = document.querySelector(`[data-message-id="${messageId}"]`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("message-highlight");
                setTimeout(() => el.classList.remove("message-highlight"), 1200);
            }
            return;
        }

        if (!numericChatId) return;
        const res = await authFetch(`${API_URL}/messages/${numericChatId}?around=${messageId}`);
        if (!res || !res.ok) return;

        const data = await res.json();
        const visible = data.messages.filter((m: Message) => !m.deletedAt);
        pendingScrollToMessageIdRef.current = messageId;
        setMessages(visible);
        setHasMoreOlder(data.hasMoreOlder);
        setHasMoreNewer(data.hasMoreNewer);
        hasMoreNewerRef.current = data.hasMoreNewer;
        if (visible.length > 0) {
            oldestIdRef.current = visible[0].id;
            newestIdRef.current = visible[visible.length - 1].id;
        }
    };

    // Returns true if ANY other participant has read this message (dot disappears)
    const isReadByAnyOther = (messageId: number): boolean =>
        Object.values(otherParticipantsReadMap).some(lastRead => lastRead >= messageId);

    const dateGroups = groupMessagesByDateAndSender({ messages, unreadDividerMessageId });

    return (
        <>
        <AppLayout
            rightPanel={
                <ChatInfoPanel
                    isOpen={isInfoOpen}
                    chatName={chatName}
                    chatType={chatType}
                    participants={participants}
                    currentUsername={currentUsername}
                    onUserClick={(id) => navigate(`/user/${id}`)}
                />
            }
        >
            <div className="chat-container">
                <ChatHeader
                    chatName={chatName}
                    chatType={chatType}
                    participantsCount={participants.length}
                    isOnline={chatType === "PRIVATE" ? isOnline(chatName) : undefined}
                    onHeaderClick={handleHeaderClick}
                    onToggleInfo={() => setIsInfoOpen(prev => !prev)}
                />

                <div
                    className={`chat-messages-wrapper${isDragging ? " drag-over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files.length > 0) {
                            handleFilesSelected(e.dataTransfer.files);
                        }
                    }}
                >
                <div
                    className="chat-messages"
                    ref={chatContainerRef}
                    onScroll={() => {
                        const el = chatContainerRef.current;
                        if (!el) return;
                        if (el.scrollTop === 0) loadOlderMessages();
                        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                        const nearBottom = distFromBottom <= 150;
                        if (nearBottom && hasMoreNewer) {
                            loadNewerMessages();
                        }
                        // Only truly "at bottom" if there are no more newer pages to load
                        isAtBottomRef.current = nearBottom && !hasMoreNewer;
                        if (nearBottom && !hasMoreNewer) {
                            triggerMarkAsRead();
                        }
                        setShowScrollBtn(hasMoreNewer || distFromBottom > 150);
                    }}
                >
                    <MessageList
                        dateGroups={dateGroups}
                        uploadingBubbles={uploadingBubbles}
                        chatType={chatType}
                        currentUsername={currentUsername}
                        unreadDividerMessageId={unreadDividerMessageId}
                        dividerRef={dividerRef}
                        deletingMessageIds={deletingMessageIds}
                        isReadByAnyOther={isReadByAnyOther}
                        onMessageContextMenu={handleMessageRightClick}
                        onScrollToMessage={scrollToMessage}
                        onImageClick={(photos, index, meta) =>
                            setViewerState({ photos, index, sender: meta.sender, createdAt: meta.createdAt })
                        }
                    />
                </div>

                <ScrollToBottomButton
                    visible={showScrollBtn}
                    hasMoreNewer={hasMoreNewer}
                    numericChatId={numericChatId}
                    authFetch={authFetch}
                    apiUrl={API_URL}
                    setMessages={setMessages}
                    setHasMoreOlder={setHasMoreOlder}
                    setHasMoreNewer={setHasMoreNewer}
                    hasMoreNewerRef={hasMoreNewerRef}
                    oldestIdRef={oldestIdRef}
                    newestIdRef={newestIdRef}
                    isAtBottomRef={isAtBottomRef}
                    triggerMarkAsRead={triggerMarkAsRead}
                />

                {typingUsers.length > 0 && <TypingIndicator text={getTypingText()} />}
                </div>

                <ReplyBar replyingTo={replyingTo} onCancel={cancelReply} />
                <EditBar
                    editingMessageId={editingMessageId}
                    originalContent={editingOriginalContent}
                    onCancel={cancelEditing}
                />

                <AttachmentsBar
                    pendingFiles={pendingFiles}
                    onRemove={(localId) =>
                        setPendingFiles(prev => prev.filter(p => p.localId !== localId))
                    }
                />

                <div className="chat-input-bar">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={(e) => {
                            if (e.target.files) handleFilesSelected(e.target.files);
                            e.target.value = "";
                        }}
                    />
                    <button
                        className="chat-attach-btn"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                    >
                        <img src="/icons/paperclip.png" alt="attach" />
                    </button>
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
                    <MessageContextMenu
                        menu={contextMenu}
                        onReply={handleStartReply}
                        onEdit={handleStartEdit}
                        onDelete={handleDeleteMessage}
                    />
                )}
            </div>
        </AppLayout>

        {viewerState && (
            <ImageViewer
                photos={viewerState.photos}
                initialIndex={viewerState.index}
                sender={viewerState.sender}
                createdAt={viewerState.createdAt}
                onClose={() => setViewerState(null)}
            />
        )}
        </>
    );
}
