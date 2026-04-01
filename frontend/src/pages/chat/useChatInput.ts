import { useState, useRef, useEffect, useCallback, type MutableRefObject } from "react";
import { authFetch } from "../../utils/authFetch";
import { API_URL } from "../../config";
import type { AttachmentDto, Message, PendingFile, UploadingBubble } from "./chatTypes";
import type { Client } from "@stomp/stompjs";

interface UseChatInputParams {
    numericChatId: number | null;
    currentUsername: string | null;
    client: Client | null;
    messages: Message[];
    hasMoreNewerRef: MutableRefObject<boolean>;
    newestIdRef: MutableRefObject<number | null>;
    scrollToBottom: () => void;
    isAtBottomRef: MutableRefObject<boolean>;
    jumpToLatest: () => Promise<void>;
}

const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024; // 40 MB
const MAX_IMAGE_DIM = 1280;
const JPEG_QUALITY  = 0.82;

function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
        // Skip GIFs — they may be animated
        if (file.type === "image/gif") { resolve(file); return; }

        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;
            if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
                const scale = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height);
                width  = Math.round(width  * scale);
                height = Math.round(height * scale);
            }

            const canvas = document.createElement("canvas");
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob || blob.size >= file.size) { resolve(file); return; }
                    const name = file.name.replace(/\.[^.]+$/, ".jpg");
                    resolve(new File([blob], name, { type: "image/jpeg" }));
                },
                "image/jpeg",
                JPEG_QUALITY,
            );
        };

        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
}

function uploadFileWithProgress(file: File, onProgress: (pct: number) => void): Promise<AttachmentDto | null> {
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
}

export function useChatInput({
    numericChatId,
    currentUsername,
    client,
    messages,
    hasMoreNewerRef,
    newestIdRef,
    scrollToBottom,
    isAtBottomRef,
    jumpToLatest,
}: UseChatInputParams) {
    const [input, setInput] = useState("");
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [uploadingBubbles, setUploadingBubbles] = useState<UploadingBubble[]>([]);
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [editingOriginalContent, setEditingOriginalContent] = useState("");
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const typingSentRef = useRef(false) as MutableRefObject<boolean>;
    const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null) as MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const uploadingBubbleTempIdRef = useRef<string | null>(null) as MutableRefObject<string | null>;
    const sentAtNewestIdRef = useRef<number | null>(null) as MutableRefObject<number | null>;

    // Reset on chat change
    useEffect(() => {
        if (!numericChatId) return;
        setPendingFiles([]);
        setUploadingBubbles([]);
        setInput("");
        setEditingMessageId(null);
        setEditingOriginalContent("");
        setReplyingTo(null);
    }, [numericChatId]);

    // Focus input on chat change
    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 150);
        return () => clearTimeout(t);
    }, [numericChatId]);

    // Remove uploading bubble when server echo appears
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
    }, [messages, currentUsername]);

    // Auto-resize textarea
    const adjustTextarea = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.overflowY = "hidden";
        el.style.height = el.scrollHeight + "px";
        const computedH = parseInt(getComputedStyle(el).height, 10);
        if (el.scrollHeight > computedH) {
            el.style.overflowY = "auto";
        }
    }, []);

    useEffect(() => {
        adjustTextarea();
    }, [input, adjustTextarea]);

    // Typing stop on unmount
    useEffect(() => {
        return () => {
            if (typingStopTimerRef.current) {
                clearTimeout(typingStopTimerRef.current);
                typingStopTimerRef.current = null;
            }
            if (typingSentRef.current && client && numericChatId) {
                typingSentRef.current = false;
                client.publish({
                    destination: "/app/chat.typing",
                    body: JSON.stringify({ chatId: numericChatId, isTyping: false }),
                });
            }
        };
    }, [client, numericChatId]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
    }, [client, numericChatId, editingMessageId]);

    const pendingFilesRef = useRef<PendingFile[]>([]) as MutableRefObject<PendingFile[]>;
    useEffect(() => { pendingFilesRef.current = pendingFiles; }, [pendingFiles]);

    const handleFilesSelected = useCallback((files: FileList | File[]) => {
        const incoming = Array.from(files);
        if (incoming.length === 0) return;

        const oversized = incoming.filter(f => f.size > MAX_FILE_SIZE_BYTES);
        if (oversized.length > 0) {
            const names = oversized.map(f => f.name).join(", ");
            alert(`File${oversized.length > 1 ? "s" : ""} exceed the 40 MB limit: ${names}`);
            return;
        }

        const incomingHasImages = incoming.some(f => f.type.startsWith("image/"));
        const incomingHasNonImages = incoming.some(f => !f.type.startsWith("image/"));

        if (incomingHasImages && incomingHasNonImages) {
            alert("Cannot mix images and files in the same message. Please select only images or only files.");
            return;
        }

        if (pendingFilesRef.current.length > 0) {
            const existingAreImages = pendingFilesRef.current[0].isImage;
            if (existingAreImages !== incomingHasImages) {
                alert("Cannot mix images and files in the same message. Remove the current attachments first.");
                return;
            }
        }

        if (incomingHasImages) {
            Promise.all(
                incoming.map(async f => {
                    const compressed = await compressImage(f);
                    const previewUrl = URL.createObjectURL(compressed);
                    let naturalWidth = 280, naturalHeight = 200;
                    try {
                        const bm = await createImageBitmap(compressed);
                        naturalWidth = bm.width;
                        naturalHeight = bm.height;
                        bm.close();
                    } catch {}
                    return {
                        localId: crypto.randomUUID(),
                        file: compressed, previewUrl, naturalWidth, naturalHeight,
                        isImage: true as const
                    };
                })
            ).then(newFiles =>
                setPendingFiles(prev => [...prev, ...newFiles]));
        } else {
            const newFiles = incoming.map(f => ({
                localId: crypto.randomUUID(),
                file: f,
                previewUrl: "",
                naturalWidth: 0,
                naturalHeight: 0,
                isImage: false as const,
            }));
            setPendingFiles(prev => [...prev, ...newFiles]);
        }
    }, []);

    // Paste handler for files (images and non-images)
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (editingMessageId !== null) return;
            if (!e.clipboardData) return;
            const pastedFiles = Array.from(e.clipboardData.items)
                .filter(item => item.kind === "file")
                .map(item => item.getAsFile())
                .filter((f): f is File => f !== null);
            if (pastedFiles.length === 0) return;
            e.preventDefault();
            handleFilesSelected(pastedFiles);
        };
        document.addEventListener("paste", handlePaste);
        return () => document.removeEventListener("paste", handlePaste);
    }, [editingMessageId, handleFilesSelected]);

    const stopTypingIndicator = useCallback(() => {
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
    }, [client, numericChatId]);

    const sendMessage = useCallback(async () => {
        const editingMessage = editingMessageId !== null ? messages.find(m => m.id === editingMessageId) : null;
        const editingHasAttachments = (editingMessage?.attachments?.length ?? 0) > 0;
        if (!input.trim() && pendingFiles.length === 0 && !editingHasAttachments) return;

        stopTypingIndicator();

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
            scrollToBottom();

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
            await jumpToLatest();
            setUploadingBubbles([]);
        } else {
            isAtBottomRef.current = true;
        }
    }, [
        input, pendingFiles, editingMessageId, replyingTo, messages,
        client, numericChatId, hasMoreNewerRef, newestIdRef,
        scrollToBottom, isAtBottomRef, stopTypingIndicator, jumpToLatest,
    ]);

    const startEdit = useCallback((messageId: number, content: string) => {
        setEditingMessageId(messageId);
        setEditingOriginalContent(content);
        setInput(content);
        setTimeout(() => inputRef.current?.focus(), 0);
    }, []);

    const cancelEditing = useCallback(() => {
        setEditingMessageId(null);
        setEditingOriginalContent("");
        setInput("");
    }, []);

    const startReply = useCallback((msg: Message) => {
        setReplyingTo(msg);
        setTimeout(() => inputRef.current?.focus(), 0);
    }, []);

    const cancelReply = useCallback(() => setReplyingTo(null), []);

    const removePendingFile = useCallback((localId: string) => {
        setPendingFiles(prev => prev.filter(p => p.localId !== localId));
    }, []);

    return {
        input,
        setInput,
        pendingFiles,
        uploadingBubbles,
        editingMessageId,
        editingOriginalContent,
        replyingTo,
        inputRef,
        fileInputRef,
        handleInputChange,
        handleFilesSelected,
        sendMessage,
        startEdit,
        cancelEditing,
        startReply,
        cancelReply,
        removePendingFile,
    };
}
