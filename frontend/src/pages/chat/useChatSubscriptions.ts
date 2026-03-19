import { useState, useRef, useEffect, useCallback, type MutableRefObject } from "react";
import type { Client } from "@stomp/stompjs";
import type { ChatParticipant, ReadAckEvent } from "./chatTypes";
import { authFetch } from "../../utils/authFetch";
import { API_URL } from "../../config";

interface UseChatSubscriptionsParams {
    numericChatId: number | null;
    currentUsername: string | null;
    chatType: string | null;
    client: Client | null;
}

export function useChatSubscriptions({
    numericChatId,
    currentUsername,
    chatType,
    client,
}: UseChatSubscriptionsParams) {
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [otherParticipantsReadMap, setOtherParticipantsReadMap] = useState<Record<string, number>>({});
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const typingTimersRef = useRef<{ [u: string]: ReturnType<typeof setTimeout> }>({}) as MutableRefObject<{ [u: string]: ReturnType<typeof setTimeout> }>;

    // Reset on chat change
    useEffect(() => {
        if (!numericChatId) return;
        setParticipants([]);
        setOtherParticipantsReadMap({});
    }, [numericChatId]);

    // Load participants
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
    }, [numericChatId, chatType, currentUsername]);

    // Read ack subscription
    useEffect(() => {
        if (!client || !numericChatId) return;

        const subscription = client.subscribe(`/topic/chat.${numericChatId}.read`, (msg: { body: string }) => {
            const body: ReadAckEvent = JSON.parse(msg.body);
            if (body.readerUsername === currentUsername) return;
            setOtherParticipantsReadMap(prev => ({
                ...prev,
                [body.readerUsername]: body.lastReadMessageId,
            }));
        });

        return () => { subscription.unsubscribe(); };
    }, [client, numericChatId, currentUsername]);

    // Typing subscription
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
        });

        return () => {
            subscription.unsubscribe();
            Object.values(typingTimersRef.current).forEach(clearTimeout);
            typingTimersRef.current = {};
            setTypingUsers([]);
        };
    }, [client, numericChatId, currentUsername]);

    const isReadByAnyOther = useCallback(
        (messageId: number): boolean =>
            Object.values(otherParticipantsReadMap).some(lastRead => lastRead >= messageId),
        [otherParticipantsReadMap],
    );

    const getTypingText = useCallback((): string => {
        if (chatType === "PRIVATE") return "typing...";
        if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
        if (typingUsers.length === 2) return `${typingUsers[0]}, ${typingUsers[1]} are typing...`;
        return `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers.length - 2} other${typingUsers.length - 2 > 1 ? "s" : ""} are typing...`;
    }, [chatType, typingUsers]);

    return {
        participants,
        typingUsers,
        otherParticipantsReadMap,
        isReadByAnyOther,
        getTypingText,
    };
}
