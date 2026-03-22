import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import AppLayout from "../components/AppLayout";
import { authFetch } from "../utils/authFetch";
import { useNavigate, useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useWebSocket } from "../context/WebSocketContext";
import { usePresence } from "../context/PresenceContext";
import { API_URL } from "../config";
import type { AttachmentDto, JwtPayload, Message } from "./chat/chatTypes";
import { groupMessagesByDateAndSender } from "./chat/groupMessages";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatInfoPanel } from "./chat/ChatInfoPanel";
import { AttachmentsBar } from "./chat/AttachmentsBar";
import { MessageContextMenu, type MessageContextMenuState } from "./chat/MessageContextMenu";
import { MessageList } from "./chat/MessageList";
import { MediaViewer } from "./chat/MediaViewer";
import { ReplyBar, EditBar } from "./chat/ReplyEditBars";
import { ScrollToBottomButton } from "./chat/ScrollToBottomButton";
import { MessageSearch } from "./chat/MessageSearch";
import { useChatScroll } from "./chat/useChatScroll";
import { useChatMessages } from "./chat/useChatMessages";
import { useChatSubscriptions } from "./chat/useChatSubscriptions";
import { useChatInput } from "./chat/useChatInput";

export default function ChatPage() {
    const { chatId } = useParams();
    const numericChatId = chatId ? Number(chatId) : null;
    const navigate = useNavigate();
    const client = useWebSocket();
    const { isOnline } = usePresence();

    const token = localStorage.getItem("accessToken");
    const currentUsername = token ? jwtDecode<JwtPayload>(token).sub : null;

    const [chatName, setChatName] = useState("");
    const [chatType, setChatType] = useState<string | null>(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSearchClosing, setIsSearchClosing] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openSearch = useCallback(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        setIsSearchClosing(false);
        setIsSearchOpen(true);
    }, []);

    const closeSearch = useCallback(() => {
        setIsSearchClosing(true);
        searchTimerRef.current = setTimeout(() => {
            setIsSearchOpen(false);
            setIsSearchClosing(false);
        }, 200);
    }, []);
    const [contextMenu, setContextMenu] = useState<MessageContextMenuState | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [viewerState, setViewerState] = useState<{
        items: AttachmentDto[];
        index: number;
        sender: string;
        createdAt: string;
    } | null>(null);

    // --- Scroll ---
    const {
        chatContainerRef, shouldScrollToBottom: shouldScrollToBottomRef,
        isAtBottomRef, hasMoreNewerRef, pendingScrollToMessageIdRef,
        triggerMarkAsRead, prepareForOlderLoad, scrollToBottom,
        requestDividerScroll, applyPendingScroll, syncHasMoreNewer, handleScrollPosition,
    } = useChatScroll(numericChatId);

    // --- Messages ---
    const {
        messages, hasMoreNewer, deletingMessageIds,
        unreadDividerMessageId, dividerRef, newestIdRef,
        loadOlderMessages, loadNewerMessages, scrollToMessage,
        startCollapseAnimation, jumpToLatest,
    } = useChatMessages({
        numericChatId,
        currentUsername,
        client,
        isAtBottomRef,
        hasMoreNewerRef,
        shouldScrollToBottom: shouldScrollToBottomRef,
        pendingScrollToMessageIdRef,
        triggerMarkAsRead,
        prepareForOlderLoad,
        scrollToBottom,
        requestDividerScroll,
    });

    // --- Subscriptions ---
    const {
        participants, typingUsers, isReadByAnyOther, getTypingText,
    } = useChatSubscriptions({
        numericChatId,
        currentUsername,
        chatType,
        client,
    });

    // --- Input ---
    const {
        input, pendingFiles, uploadingBubbles,
        editingMessageId, editingOriginalContent, replyingTo,
        inputRef, fileInputRef,
        handleInputChange, handleFilesSelected, sendMessage,
        startEdit, cancelEditing, startReply, cancelReply, removePendingFile,
    } = useChatInput({
        numericChatId,
        currentUsername,
        client,
        messages,
        hasMoreNewerRef,
        newestIdRef,
        scrollToBottom,
        isAtBottomRef,
        jumpToLatest,
    });

    // Keep scroll ref in sync with actual hasMoreNewer
    useEffect(() => {
        syncHasMoreNewer(hasMoreNewer);
    }, [hasMoreNewer, syncHasMoreNewer]);

    // Load chat name/type
    useEffect(() => {
        if (!numericChatId) return;
        let cancelled = false;

        type MyChatItem = { chatId: number; displayName: string; type: string };

        const loadChatInfo = async () => {
            const res = await authFetch(`${API_URL}/chat/my`);
            if (cancelled || !res || !res.ok) return;
            const data: MyChatItem[] = await res.json();
            if (cancelled) return;
            const currentChat = data.find((c) => c.chatId === numericChatId);
            if (currentChat) {
                setChatName(currentChat.displayName);
                setChatType(currentChat.type);
            }
        };

        loadChatInfo();
        return () => { cancelled = true; };
    }, [numericChatId]);

    // Apply pending scroll actions after messages/divider change (useLayoutEffect = before paint)
    useLayoutEffect(() => {
        if (messages.length === 0) return;
        applyPendingScroll();
    }, [messages, unreadDividerMessageId, applyPendingScroll]);

    // Context menu close on click outside
    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [contextMenu]);

    // Escape key handler
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (contextMenu) {
                setContextMenu(null);
            } else if (isSearchOpen) {
                closeSearch();
            } else if (editingMessageId !== null) {
                cancelEditing();
            } else if (replyingTo !== null) {
                cancelReply();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [contextMenu, isSearchOpen, closeSearch, editingMessageId, replyingTo, cancelEditing, cancelReply]);

    // --- Handlers ---

    const handleSearchNavigate = useCallback((messageId: number) => {
        scrollToMessage(messageId);
    }, [scrollToMessage]);

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

    const handleMessageRightClick = (e: React.MouseEvent, msg: Message, isMine: boolean) => {
        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - 148);
        const y = Math.min(e.clientY, window.innerHeight - 160);
        setContextMenu({ x, y, messageId: msg.id, content: msg.content, sender: msg.sender, isMine });
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
        startEdit(contextMenu.messageId, contextMenu.content);
        setContextMenu(null);
    };

    const handleStartReply = () => {
        if (!contextMenu) return;
        const msg = messages.find(m => m.id === contextMenu.messageId);
        if (msg) startReply(msg);
        setContextMenu(null);
    };

    const handleScroll = () => {
        const el = chatContainerRef.current;
        if (!el) return;
        if (el.scrollTop === 0) loadOlderMessages();
        const { nearBottom, distFromBottom } = handleScrollPosition(hasMoreNewer);
        if (nearBottom && hasMoreNewer) {
            loadNewerMessages();
        }
        setShowScrollBtn(hasMoreNewer || distFromBottom > 150);
    };

    const dateGroups = groupMessagesByDateAndSender({
        messages,
        unreadDividerMessageId,
    });

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
                    typingText={typingUsers.length > 0 ? getTypingText() : undefined}
                    onHeaderClick={handleHeaderClick}
                    onToggleInfo={() => setIsInfoOpen(prev => !prev)}
                    onToggleSearch={() => isSearchOpen ? closeSearch() : openSearch()}
                    isSearchOpen={isSearchOpen}
                />

                {isSearchOpen && numericChatId && (
                    <MessageSearch
                        chatId={numericChatId}
                        onNavigate={handleSearchNavigate}
                        onClose={closeSearch}
                        isClosing={isSearchClosing}
                    />
                )}

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
                    onScroll={handleScroll}
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
                        onMediaClick={(items, index, meta) =>
                            setViewerState({ items, index, sender: meta.sender, createdAt: meta.createdAt })
                        }
                    />
                </div>

                {showScrollBtn && (
                    <ScrollToBottomButton
                        hasMoreNewer={hasMoreNewer}
                        onJumpToLatest={jumpToLatest}
                    />
                )}

                </div>

                <ReplyBar replyingTo={replyingTo} onCancel={cancelReply} />
                <EditBar
                    editingMessageId={editingMessageId}
                    originalContent={editingOriginalContent}
                    onCancel={cancelEditing}
                />

                <AttachmentsBar
                    pendingFiles={pendingFiles}
                    onRemove={removePendingFile}
                />

                <div className="chat-input-bar">
                    <input
                        ref={fileInputRef}
                        type="file"
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
            <MediaViewer
                items={viewerState.items}
                initialIndex={viewerState.index}
                sender={viewerState.sender}
                createdAt={viewerState.createdAt}
                onClose={() => setViewerState(null)}
            />
        )}
        </>
    );
}
