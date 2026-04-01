import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttachmentDto } from "./chatTypes";
import { formatMessageTime } from "./chatFormat";

function formatViewerTime(createdAt: string): string {
    const date = new Date(createdAt);
    const now = new Date();
    const time = formatMessageTime(createdAt);
    if (date.toDateString() === now.toDateString()) return time;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
    const month = date.toLocaleDateString("en-US", { month: "short" });
    return `${month}. ${date.getDate()}, ${time}`;
}

interface Props {
    items: AttachmentDto[];
    initialIndex: number;
    sender: string;
    createdAt: string;
    onClose: () => void;
}

function isVideo(item: AttachmentDto): boolean {
    return item.type === "VIDEO";
}

interface TouchGesture {
    type: "pan" | "pinch";
    // pan
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
    // pinch
    initialDist: number;
    initialScale: number;
    /** focal point relative to viewport center — used for anchor-under-fingers math */
    focalDX: number;
    focalDY: number;
}

export function MediaViewer({ items, initialIndex, sender, createdAt, onClose }: Props) {
    const [index, setIndex] = useState(initialIndex);
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const thumbnailRefs = useRef<(HTMLDivElement | null)[]>([]);
    const videoRef = useRef<HTMLVideoElement>(null);
    const touchGesture = useRef<TouchGesture | null>(null);

    // Live refs — always hold the latest scale/pan for use inside non-React
    // event handlers that are registered once (empty deps, can't close over state).
    const liveScale = useRef(1);
    const livePan = useRef({ x: 0, y: 0 });
    useLayoutEffect(() => { liveScale.current = scale; }, [scale]);
    useLayoutEffect(() => { livePan.current = pan; }, [pan]);

    const item = items[index];
    const currentIsVideo = isVideo(item);
    const currentIsVideoRef = useRef(currentIsVideo);
    useLayoutEffect(() => { currentIsVideoRef.current = currentIsVideo; }, [currentIsVideo]);

    const resetTransform = () => {
        liveScale.current = 1;
        livePan.current = { x: 0, y: 0 };
        setScale(1);
        setPan({ x: 0, y: 0 });
    };

    const goTo = (i: number) => {
        videoRef.current?.pause();
        setIndex(i);
        resetTransform();
    };

    const handleClose = () => {
        videoRef.current?.pause();
        onClose();
    };

    // Lock body scroll while open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { handleClose(); return; }
            if (e.key === "ArrowLeft" && index > 0) goTo(index - 1);
            if (e.key === "ArrowRight" && index < items.length - 1) goTo(index + 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [index, items.length]);

    // Wheel zoom — desktop
    useEffect(() => {
        const el = backdropRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (currentIsVideoRef.current) return;
            if ((e.target as HTMLElement).closest(".iv-thumbnail-strip")) return;
            e.preventDefault();
            const pixels = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
            const factor = Math.exp(-pixels / 200);
            setScale(prev => Math.min(16, Math.max(0.25, prev * factor)));
        };
        el.addEventListener("wheel", handler, { passive: false });
        return () => el.removeEventListener("wheel", handler);
    }, []);

    // Pinch-to-zoom + touch pan — mobile
    // Registered once with empty deps; reads live refs for current state.
    useEffect(() => {
        const el = backdropRef.current;
        if (!el) return;

        const hypot = (t1: Touch, t2: Touch) =>
            Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

        const onTouchStart = (e: TouchEvent) => {
            // Let the thumbnail strip handle its own scroll
            if ((e.target as HTMLElement).closest(".iv-thumbnail-strip-mask")) return;

            if (e.touches.length === 2 && !currentIsVideoRef.current) {
                // Two fingers: enter pinch mode.
                // preventDefault here stops iOS Safari from doing a native page zoom.
                e.preventDefault();
                const t1 = e.touches[0], t2 = e.touches[1];
                const focalX = (t1.clientX + t2.clientX) / 2;
                const focalY = (t1.clientY + t2.clientY) / 2;
                touchGesture.current = {
                    type: "pinch",
                    startX: 0, startY: 0,
                    initialPanX: livePan.current.x,
                    initialPanY: livePan.current.y,
                    initialDist: hypot(t1, t2),
                    initialScale: liveScale.current,
                    // Focal point relative to viewport center (cx = vw/2, cy = vh/2).
                    // Used in anchor formula: newPan = focal - ratio*(focal - initPan)
                    focalDX: focalX - window.innerWidth / 2,
                    focalDY: focalY - window.innerHeight / 2,
                };
            } else if (e.touches.length === 1) {
                // Single finger: pan mode.
                // No preventDefault — keeps click events alive for tap-to-close.
                const t = e.touches[0];
                touchGesture.current = {
                    type: "pan",
                    startX: t.clientX,
                    startY: t.clientY,
                    initialPanX: livePan.current.x,
                    initialPanY: livePan.current.y,
                    initialDist: 0, initialScale: 1, focalDX: 0, focalDY: 0,
                };
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if ((e.target as HTMLElement).closest(".iv-thumbnail-strip-mask")) return;
            // Prevent scroll AND browser zoom during any active gesture
            e.preventDefault();

            const g = touchGesture.current;
            if (!g) return;

            if (e.touches.length === 2 && g.type === "pinch") {
                const dist = hypot(e.touches[0], e.touches[1]);
                const ratio = dist / g.initialDist;
                const newScale = Math.min(16, Math.max(0.25, g.initialScale * ratio));
                // Anchor-under-fingers formula:
                //   newPan = focal - ratio * (focal - initPan)
                // Derived from: image point at focal must map to same screen coord before and after scale.
                const newPan = {
                    x: g.focalDX - ratio * (g.focalDX - g.initialPanX),
                    y: g.focalDY - ratio * (g.focalDY - g.initialPanY),
                };
                liveScale.current = newScale;
                livePan.current = newPan;
                setScale(newScale);
                setPan(newPan);
            } else if (e.touches.length === 1 && g.type === "pan") {
                const t = e.touches[0];
                const newPan = {
                    x: g.initialPanX + (t.clientX - g.startX),
                    y: g.initialPanY + (t.clientY - g.startY),
                };
                livePan.current = newPan;
                setPan(newPan);
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            if ((e.target as HTMLElement).closest(".iv-thumbnail-strip-mask")) return;

            if (e.touches.length === 0) {
                touchGesture.current = null;
            } else if (e.touches.length === 1 && touchGesture.current?.type === "pinch") {
                // One finger lifted while pinching — transition seamlessly to pan
                const t = e.touches[0];
                touchGesture.current = {
                    type: "pan",
                    startX: t.clientX,
                    startY: t.clientY,
                    initialPanX: livePan.current.x,
                    initialPanY: livePan.current.y,
                    initialDist: 0, initialScale: 1, focalDX: 0, focalDY: 0,
                };
            }
        };

        const onTouchCancel = () => { touchGesture.current = null; };

        el.addEventListener("touchstart", onTouchStart, { passive: false });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd);
        el.addEventListener("touchcancel", onTouchCancel);
        return () => {
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
            el.removeEventListener("touchend", onTouchEnd);
            el.removeEventListener("touchcancel", onTouchCancel);
        };
    }, []); // empty deps — correct; all mutable state accessed via live refs

    // Global mouseup — stop desktop drag if cursor leaves window
    useEffect(() => {
        const stop = () => { setIsDragging(false); dragRef.current = null; };
        window.addEventListener("mouseup", stop);
        return () => window.removeEventListener("mouseup", stop);
    }, []);

    // Scroll active thumbnail into view
    useEffect(() => {
        thumbnailRefs.current[index]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }, [index]);

    // ── Desktop mouse drag ──────────────────────────────────────
    const onMouseDown = (e: React.MouseEvent) => {
        if (currentIsVideo || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
        setIsDragging(true);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragRef.current) return;
        setPan({
            x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
            y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
        });
    };

    const onBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) handleClose();
    };

    const stopProp = (e: React.MouseEvent) => e.stopPropagation();

    const zoomIn = (e: React.MouseEvent) => {
        stopProp(e);
        const s = Math.min(16, liveScale.current * 1.5);
        liveScale.current = s;
        setScale(s);
    };
    const zoomOut = (e: React.MouseEvent) => {
        stopProp(e);
        const s = Math.max(0.25, liveScale.current / 1.5);
        liveScale.current = s;
        setScale(s);
    };
    const zoomReset = (e: React.MouseEvent) => {
        stopProp(e);
        resetTransform();
    };

    const currentSender = item.senderUsername || sender;
    const currentCreatedAt = item.createdAt || createdAt;
    const formattedTime = formatViewerTime(currentCreatedAt);
    const avatarLetter = currentSender.charAt(0).toUpperCase();
    const hasStrip = items.length > 1;

    return createPortal(
        <div
            ref={backdropRef}
            className="iv-backdrop"
            onClick={onBackdropClick}
            onMouseMove={onMouseMove}
        >
            {/* Main content */}
            {currentIsVideo ? (
                <video
                    key={item.url}
                    ref={videoRef}
                    src={item.url}
                    className="iv-video"
                    controls
                    autoPlay
                    onClick={stopProp}
                />
            ) : (
                <img
                    src={item.url}
                    alt={item.fileName}
                    className={`iv-image${isDragging ? " dragging" : ""}`}
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        cursor: isDragging ? "grabbing" : scale > 1 ? "grab" : "default",
                    }}
                    onMouseDown={onMouseDown}
                    onClick={stopProp}
                    draggable={false}
                />
            )}

            {/* Arrow: previous */}
            {index > 0 && (
                <div className="iv-arrow-zone iv-arrow-zone-left" onClick={(e) => { stopProp(e); goTo(index - 1); }}>
                    <img src="/icons/left-chevron.png" className="iv-arrow" alt="previous" />
                </div>
            )}

            {/* Arrow: next */}
            {index < items.length - 1 && (
                <div className="iv-arrow-zone iv-arrow-zone-right" onClick={(e) => { stopProp(e); goTo(index + 1); }}>
                    <img src="/icons/left-chevron.png" className="iv-arrow iv-arrow-right-icon" alt="next" />
                </div>
            )}

            {/* Bottom gradient overlay */}
            <div className="iv-bottom-gradient" />

            {/* Thumbnail strip */}
            {hasStrip && (
                <div className="iv-thumbnail-strip-mask" onClick={stopProp}>
                <div className="iv-thumbnail-strip">
                    {items.map((p, i) => (
                        <div
                            key={p.id}
                            ref={el => { thumbnailRefs.current[i] = el; }}
                            className={`iv-thumbnail${i === index ? " active" : ""}`}
                            onClick={(e) => { stopProp(e); goTo(i); }}
                        >
                            {isVideo(p) ? (
                                <div className="iv-thumbnail-video">
                                    <video src={p.url} preload="metadata" muted />
                                    <div className="iv-thumbnail-play-icon" />
                                </div>
                            ) : (
                                <img src={p.url} alt={p.fileName} draggable={false} />
                            )}
                        </div>
                    ))}
                </div>
                </div>
            )}

            {/* Meta — pinned bottom-left */}
            <div className="iv-meta" onClick={stopProp}>
                <div className="iv-avatar">{avatarLetter}</div>
                <div className="iv-sender-info">
                    <span className="iv-sender-name">{currentSender}</span>
                    <span className="iv-time">{formattedTime}</span>
                </div>
            </div>

            {/* Zoom controls — images only */}
            {!currentIsVideo && (
                <div className="iv-zoom-controls" onClick={stopProp}>
                    <button className="iv-zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
                    <button className="iv-zoom-btn iv-zoom-reset" onClick={zoomReset} title="Reset zoom">1:1</button>
                    <button className="iv-zoom-btn" onClick={zoomOut} title="Zoom out">−</button>
                </div>
            )}
        </div>,
        document.body
    );
}
