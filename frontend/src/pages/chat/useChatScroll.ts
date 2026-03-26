import { useRef, useEffect, useCallback, useLayoutEffect, type MutableRefObject } from "react";
import { authFetch } from "../../utils/authFetch";
import { API_URL } from "../../config";

export function useChatScroll(numericChatId: number | null) {
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const shouldScrollToBottom = useRef(false) as MutableRefObject<boolean>;
    const shouldRestoreScroll = useRef(false) as MutableRefObject<boolean>;
    const savedScrollHeight = useRef(0) as MutableRefObject<number>;
    const isAtBottomRef = useRef(true) as MutableRefObject<boolean>;
    const pendingScrollToMessageIdRef = useRef<number | null>(null) as MutableRefObject<number | null>;
    const pendingDividerScrollRef = useRef(false) as MutableRefObject<boolean>;
    const markAsReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null) as MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const hasMoreNewerRef = useRef(false) as MutableRefObject<boolean>;

    // Reset all scroll refs on chat change
    useLayoutEffect(() => {
        if (!numericChatId) return;
        shouldScrollToBottom.current = false;
        shouldRestoreScroll.current = false;
        savedScrollHeight.current = 0;
        isAtBottomRef.current = true;
        pendingScrollToMessageIdRef.current = null;
        pendingDividerScrollRef.current = false;
        hasMoreNewerRef.current = false;
    }, [numericChatId]);

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

    const requestDividerScroll = useCallback(() => {
        pendingDividerScrollRef.current = true;
    }, []);

    /** Call after each render where messages changed to apply pending scroll actions. */
    const applyPendingScroll = useCallback(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        if (shouldScrollToBottom.current) {
            container.scrollTop = container.scrollHeight;
            shouldScrollToBottom.current = false;
            isAtBottomRef.current = true;
            if (!hasMoreNewerRef.current) triggerMarkAsRead();
        } else if (shouldRestoreScroll.current) {
            container.scrollTop = container.scrollHeight - savedScrollHeight.current;
            shouldRestoreScroll.current = false;
        } else if (pendingDividerScrollRef.current) {
            const divider = container.querySelector(".unread-messages-divider");
            if (divider) {
                const containerTop = container.getBoundingClientRect().top;
                const dividerTop = divider.getBoundingClientRect().top;
                // Offset by 60px so the divider isn't hidden behind the top gradient/date pill
                container.scrollTop += dividerTop - containerTop - 60;
                pendingDividerScrollRef.current = false;
                const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
                if (distFromBottom <= 150 && !hasMoreNewerRef.current) {
                    isAtBottomRef.current = true;
                    triggerMarkAsRead();
                }
            }
        } else if (pendingScrollToMessageIdRef.current !== null) {
            const targetId = pendingScrollToMessageIdRef.current;
            pendingScrollToMessageIdRef.current = null;
            requestAnimationFrame(() => {
                const container = chatContainerRef.current;
                const el = document.querySelector(`[data-message-id="${targetId}"]`) as HTMLElement | null;
                if (el && container) {
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
                    el.classList.add("message-highlight");
                    setTimeout(() => el.classList.remove("message-highlight"), 1200);
                }
            });
        }
    }, [triggerMarkAsRead]);

    const syncHasMoreNewer = useCallback((value: boolean) => {
        hasMoreNewerRef.current = value;
    }, []);

    const onMediaLoad = useCallback(() => {
        if (!isAtBottomRef.current) return;
        const container = chatContainerRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
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
        requestDividerScroll,
        applyPendingScroll,
        syncHasMoreNewer,
        handleScrollPosition,
        onMediaLoad,
    };
}
