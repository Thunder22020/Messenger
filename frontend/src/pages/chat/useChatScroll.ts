import { useRef, useEffect, useCallback, type MutableRefObject } from "react";
import { authFetch } from "../../utils/authFetch";
import { API_URL } from "../../config";

export function useChatScroll(numericChatId: number | null) {
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const shouldScrollToBottom = useRef(false) as MutableRefObject<boolean>;
    const shouldRestoreScroll = useRef(false) as MutableRefObject<boolean>;
    const savedScrollHeight = useRef(0) as MutableRefObject<number>;
    const isAtBottomRef = useRef(true) as MutableRefObject<boolean>;
    const pendingScrollToMessageIdRef = useRef<number | null>(null) as MutableRefObject<number | null>;
    const markAsReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null) as MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const hasMoreNewerRef = useRef(false) as MutableRefObject<boolean>;

    const triggerMarkAsRead = useCallback(() => {
        if (!numericChatId) return;
        if (document.visibilityState !== "visible") return;
        if (markAsReadTimeoutRef.current) clearTimeout(markAsReadTimeoutRef.current);
        markAsReadTimeoutRef.current = setTimeout(() => {
            authFetch(`${API_URL}/chat/${numericChatId}/read`, { method: "POST" });
            markAsReadTimeoutRef.current = null;
        }, 300);
    }, [numericChatId]);

    // Visibility change handler
    useEffect(() => {
        const handleVisible = () => {
            if (document.visibilityState === "visible" && isAtBottomRef.current) {
                triggerMarkAsRead();
            }
        };
        document.addEventListener("visibilitychange", handleVisible);
        return () => document.removeEventListener("visibilitychange", handleVisible);
    }, [triggerMarkAsRead]);

    const prepareForOlderLoad = useCallback(() => {
        savedScrollHeight.current = chatContainerRef.current?.scrollHeight ?? 0;
        shouldScrollToBottom.current = false;
        shouldRestoreScroll.current = true;
    }, []);

    const scrollToBottom = useCallback(() => {
        shouldScrollToBottom.current = true;
        isAtBottomRef.current = true;
    }, []);

    /** Call after each render where messages changed to apply pending scroll actions. */
    const applyPendingScroll = useCallback(() => {
        const container = chatContainerRef.current;
        if (!container) return;

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
    }, []);

    const syncHasMoreNewer = useCallback((value: boolean) => {
        hasMoreNewerRef.current = value;
    }, []);

    /** Call from onScroll handler. Returns { nearBottom, distFromBottom }. */
    const handleScrollPosition = useCallback((hasMoreNewer: boolean) => {
        const el = chatContainerRef.current;
        if (!el) return { nearBottom: false, distFromBottom: 0 };

        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const nearBottom = distFromBottom <= 150;
        isAtBottomRef.current = nearBottom && !hasMoreNewer;
        if (nearBottom && !hasMoreNewer) {
            triggerMarkAsRead();
        }
        return { nearBottom, distFromBottom };
    }, [triggerMarkAsRead]);

    return {
        chatContainerRef,
        shouldScrollToBottom,
        isAtBottomRef,
        hasMoreNewerRef,
        pendingScrollToMessageIdRef,
        triggerMarkAsRead,
        prepareForOlderLoad,
        scrollToBottom,
        applyPendingScroll,
        syncHasMoreNewer,
        handleScrollPosition,
    };
}
