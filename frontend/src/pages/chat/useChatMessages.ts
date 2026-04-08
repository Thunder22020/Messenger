import { useState, useRef, useEffect, useCallback, type MutableRefObject } from "react";
import { authFetch } from "../../utils/authFetch";
import { API_URL } from "../../config";
import type { Message, ReactionDto } from "./chatTypes";
import type { Client } from "@stomp/stompjs";

const COLLAPSE_MS = 320;

interface UseChatMessagesParams {
    numericChatId: number | null;
    currentUsername: string | null;
    client: Client | null;
    isAtBottomRef: MutableRefObject<boolean>;
    hasMoreNewerRef: MutableRefObject<boolean>;
    shouldScrollToBottom: MutableRefObject<boolean>;
    pendingScrollToMessageIdRef: MutableRefObject<number | null>;
    triggerMarkAsRead: () => void;
    prepareForOlderLoad: () => void;
    scrollToBottom: () => void;
    requestDividerScroll: () => void;
}

export function useChatMessages({
    numericChatId,
    currentUsername,
    client,
    isAtBottomRef,
    hasMoreNewerRef,
    shouldScrollToBottom,
    pendingScrollToMessageIdRef,
    triggerMarkAsRead,
    prepareForOlderLoad,
    scrollToBottom,
    requestDividerScroll,
}: UseChatMessagesParams) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasMoreOlder, setHasMoreOlder] = useState(false);
    const [hasMoreNewer, setHasMoreNewer] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [deletingMessageIds, setDeletingMessageIds] = useState<Set<number>>(new Set());

    // undefined = not yet determined, null = no previous read, number = last read id
    const [initialLastReadMessageId, setInitialLastReadMessageId] = useState<number | null | undefined>(undefined);
    // undefined = not yet set, null = no divider needed, number = first unread message id
    const [unreadDividerMessageId, setUnreadDividerMessageId] = useState<number | null | undefined>(undefined);
    const dividerDeterminedRef = useRef(false) as MutableRefObject<boolean>;
    const dividerRef = useRef<HTMLDivElement | null>(null);
    const oldestIdRef = useRef<number | null>(null) as MutableRefObject<number | null>;
    const newestIdRef = useRef<number | null>(null) as MutableRefObject<number | null>;
    const animatingDeleteIdsRef = useRef<Set<number>>(new Set()) as MutableRefObject<Set<number>>;

    // Reset state on chat change
    useEffect(() => {
        if (!numericChatId) return;
        setMessages([]);
        setHasMoreOlder(false);
        setHasMoreNewer(false);
        oldestIdRef.current = null;
        newestIdRef.current = null;
        dividerDeterminedRef.current = false;
        setUnreadDividerMessageId(undefined);
        setInitialLastReadMessageId(undefined);
    }, [numericChatId]);

    // Load chat info (lastReadMessageId)
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
                setInitialLastReadMessageId(currentChat.lastReadMessageId ?? null);
            }
        };

        loadChatInfo();
        return () => { cancelled = true; };
    }, [numericChatId]);

    // Load initial messages once chat info is ready
    useEffect(() => {
        if (!numericChatId) return;
        if (initialLastReadMessageId === undefined) return;
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

            // For "no unread" case: set scroll-to-bottom BEFORE setMessages
            // so applyPendingScroll handles it on the same render
            if (initialLastReadMessageId === null && !data.hasMoreNewer) {
                shouldScrollToBottom.current = true;
            }

            setMessages(visible);
            setHasMoreOlder(data.hasMoreOlder);
            setHasMoreNewer(data.hasMoreNewer);
            if (visible.length > 0) {
                oldestIdRef.current = visible[0].id;
                newestIdRef.current = visible[visible.length - 1].id;
            }
        };

        loadMessages();
        return () => { cancelled = true; };
    }, [numericChatId, initialLastReadMessageId, shouldScrollToBottom]);

    // Determine divider position once, then request scroll
    useEffect(() => {
        if (dividerDeterminedRef.current) return;
        if (initialLastReadMessageId === undefined) return;
        if (messages.length === 0) return;

        dividerDeterminedRef.current = true;
        const firstUnread = messages.find(
            m => m.id > (initialLastReadMessageId ?? -1) && m.sender !== currentUsername
        );

        if (firstUnread) {
            setUnreadDividerMessageId(firstUnread.id);
            requestDividerScroll();
        } else {
            setUnreadDividerMessageId(null);
            // Everything is read - scroll to bottom
            // (already set in loadMessages for null case, but cover the "around" case too)
            shouldScrollToBottom.current = true;
        }
    }, [messages, initialLastReadMessageId, currentUsername, requestDividerScroll, shouldScrollToBottom]);

    // WS subscription for messages
    useEffect(() => {
        if (!client || !numericChatId) return;

        const subscription = client.subscribe(`/topic/chat.${numericChatId}`, (msg: { body: string }) => {
            const body: Message = JSON.parse(msg.body);

            if (body.deletedAt) {
                setMessages(prev => {
                    const idx = prev.findIndex(m => m.id === body.id);
                    if (idx === -1) return prev;
                    return prev.map(m =>
                        m.replyPreview?.messageId === body.id
                            ? { ...m, replyPreview: { ...m.replyPreview, content: "", attachmentType: null } }
                            : m
                    );
                });
                startCollapseAnimation(body.id);
                return;
            }

            let appearedAsNew = false;
            setMessages(prev => {
                const idx = prev.findIndex(m => m.id === body.id);
                if (idx === -1) {
                    if (hasMoreNewerRef.current) return prev;
                    appearedAsNew = true;
                    if (isAtBottomRef.current) {
                        shouldScrollToBottom.current = true;
                    }
                    return [...prev, body];
                }
                const next = [...prev];
                next[idx] = {
                    ...body,
                    reactions: body.reactions?.length ? body.reactions : prev[idx].reactions,
                };
                return next.map(m =>
                    m.replyPreview?.messageId === body.id
                        ? { ...m, replyPreview: { ...m.replyPreview, content: body.content } }
                        : m
                );
            });
            if (appearedAsNew && isAtBottomRef.current) {
                triggerMarkAsRead();
            }
        });

        return () => { subscription.unsubscribe(); };
    }, [client, numericChatId]);

    // Fetch messages missed during inactivity when the tab becomes visible again
    useEffect(() => {
        const onVisible = async () => {
            if (document.visibilityState !== "visible") return;
            if (!numericChatId || !newestIdRef.current) return;
            if (hasMoreNewerRef.current) return; // not at the bottom — user can load manually

            const res = await authFetch(`${API_URL}/messages/${numericChatId}?after=${newestIdRef.current}`);
            if (!res || !res.ok) return;
            const data = await res.json();
            const visible = data.messages.filter((m: Message) => !m.deletedAt);
            if (visible.length === 0) return;

            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const newMessages = visible.filter((m: Message) => !existingIds.has(m.id));
                if (newMessages.length === 0) return prev;
                return [...prev, ...newMessages];
            });
            setHasMoreNewer(data.hasMoreNewer);
            newestIdRef.current = visible[visible.length - 1].id;
            if (isAtBottomRef.current) {
                shouldScrollToBottom.current = true;
            }
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [numericChatId]);

    const startCollapseAnimation = useCallback((messageId: number) => {
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
    }, []);

    const loadOlderMessages = useCallback(async () => {
        if (!hasMoreOlder || isLoadingMore || !numericChatId || oldestIdRef.current === null) return;

        setIsLoadingMore(true);
        prepareForOlderLoad();

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
    }, [hasMoreOlder, isLoadingMore, numericChatId, prepareForOlderLoad]);

    const loadNewerMessages = useCallback(async () => {
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
        if (visible.length > 0) newestIdRef.current = visible[visible.length - 1].id;
        setIsLoadingMore(false);
    }, [hasMoreNewer, isLoadingMore, numericChatId]);

    const scrollToMessage = useCallback(async (messageId: number) => {
        const isLoaded = messages.some(m => m.id === messageId);
        if (isLoaded) {
            const el = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
            if (el) {
                const container = document.querySelector(".chat-messages") as HTMLElement | null;
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    const fullyVisible =
                        elRect.top >= containerRect.top &&
                        elRect.bottom <= containerRect.bottom;
                    if (!fullyVisible) {
                        const elRelativeTop = elRect.top - containerRect.top + container.scrollTop;
                        const targetScrollTop = elRelativeTop - container.clientHeight / 2 + el.offsetHeight / 2;
                        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
                    }
                }
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
        if (visible.length > 0) {
            oldestIdRef.current = visible[0].id;
            newestIdRef.current = visible[visible.length - 1].id;
        }
    }, [messages, numericChatId, pendingScrollToMessageIdRef]);

    const onReactionUpdated = useCallback((messageId: number, reactions: ReactionDto[]) => {
        setMessages(prev => {
            const idx = prev.findIndex(m => m.id === messageId);
            if (idx === -1) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], reactions };
            return next;
        });
    }, []);

    const jumpToLatest = useCallback(async () => {
        if (!numericChatId) return;
        const res = await authFetch(`${API_URL}/messages/${numericChatId}`);
        if (!res || !res.ok) return;
        const data = await res.json();
        const visible: Message[] = data.messages.filter((m: Message) => !m.deletedAt);
        setMessages(visible);
        setHasMoreOlder(data.hasMoreOlder);
        setHasMoreNewer(false);
        if (visible.length > 0) {
            oldestIdRef.current = visible[0].id;
            newestIdRef.current = visible[visible.length - 1].id;
        }
        scrollToBottom();
        triggerMarkAsRead();
    }, [numericChatId, scrollToBottom, triggerMarkAsRead]);

    return {
        messages,
        hasMoreOlder,
        hasMoreNewer,
        deletingMessageIds,
        unreadDividerMessageId,
        dividerRef,
        newestIdRef,
        loadOlderMessages,
        loadNewerMessages,
        scrollToMessage,
        startCollapseAnimation,
        onReactionUpdated,
        jumpToLatest,
    };
}
