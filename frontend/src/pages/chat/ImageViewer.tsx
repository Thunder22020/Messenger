import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttachmentDto } from "./chatTypes";
import { formatMessageTime } from "./chatFormat";

interface Props {
    photos: AttachmentDto[];
    initialIndex: number;
    sender: string;
    createdAt: string;
    onClose: () => void;
}

export function ImageViewer({ photos, initialIndex, sender, createdAt, onClose }: Props) {
    const [index, setIndex] = useState(initialIndex);
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const thumbnailRefs = useRef<(HTMLDivElement | null)[]>([]);

    const photo = photos[index];

    const goTo = (i: number) => {
        setIndex(i);
        setScale(1);
        setPan({ x: 0, y: 0 });
    };

    // Lock body scroll while open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { onClose(); return; }
            if (e.key === "ArrowLeft" && index > 0) goTo(index - 1);
            if (e.key === "ArrowRight" && index < photos.length - 1) goTo(index + 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [index, photos.length]);

    // Non-passive wheel listener for zoom
    useEffect(() => {
        const el = backdropRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if ((e.target as HTMLElement).closest(".iv-thumbnail-strip")) return;
            e.preventDefault();
            const pixels = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
            const factor = Math.exp(-pixels / 200);
            setScale(prev => Math.min(16, Math.max(0.25, prev * factor)));
        };
        el.addEventListener("wheel", handler, { passive: false });
        return () => el.removeEventListener("wheel", handler);
    }, []);

    // Global mouseup to stop drag even if cursor leaves window
    useEffect(() => {
        const stop = () => { setIsDragging(false); dragRef.current = null; };
        window.addEventListener("mouseup", stop);
        return () => window.removeEventListener("mouseup", stop);
    }, []);

    // Scroll active thumbnail into view
    useEffect(() => {
        thumbnailRefs.current[index]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }, [index]);

    const onMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
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
        if (e.target === e.currentTarget) onClose();
    };

    const stopProp = (e: React.MouseEvent) => e.stopPropagation();

    const zoomIn  = (e: React.MouseEvent) => { stopProp(e); setScale(s => Math.min(16, s * 1.5)); };
    const zoomOut = (e: React.MouseEvent) => { stopProp(e); setScale(s => Math.max(0.25, s / 1.5)); };
    const zoomReset = (e: React.MouseEvent) => { stopProp(e); setScale(1); setPan({ x: 0, y: 0 }); };

    const formattedTime = formatMessageTime(createdAt);
    const avatarLetter = sender.charAt(0).toUpperCase();
    const hasStrip = photos.length > 1;

    return createPortal(
        <div
            ref={backdropRef}
            className="iv-backdrop"
            onClick={onBackdropClick}
            onMouseMove={onMouseMove}
        >
            {/* Main image */}
            <img
                src={photo.url}
                alt={photo.fileName}
                className={`iv-image${isDragging ? " dragging" : ""}`}
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                    cursor: isDragging ? "grabbing" : scale > 1 ? "grab" : "default",
                }}
                onMouseDown={onMouseDown}
                onClick={stopProp}
                draggable={false}
            />

            {/* Arrow: previous */}
            {index > 0 && (
                <div className="iv-arrow-zone iv-arrow-zone-left" onClick={(e) => { stopProp(e); goTo(index - 1); }}>
                    <img src="/icons/left-chevron.png" className="iv-arrow" alt="previous" />
                </div>
            )}

            {/* Arrow: next */}
            {index < photos.length - 1 && (
                <div className="iv-arrow-zone iv-arrow-zone-right" onClick={(e) => { stopProp(e); goTo(index + 1); }}>
                    <img src="/icons/left-chevron.png" className="iv-arrow iv-arrow-right-icon" alt="next" />
                </div>
            )}

            {/* Bottom gradient overlay */}
            <div className="iv-bottom-gradient" />

            {/* Thumbnail strip — centered above the corner elements */}
            {hasStrip && (
                <div className="iv-thumbnail-strip" onClick={stopProp}>
                    {photos.map((p, i) => (
                        <div
                            key={p.id}
                            ref={el => { thumbnailRefs.current[i] = el; }}
                            className={`iv-thumbnail${i === index ? " active" : ""}`}
                            onClick={(e) => { stopProp(e); goTo(i); }}
                        >
                            <img src={p.url} alt={p.fileName} draggable={false} />
                        </div>
                    ))}
                </div>
            )}

            {/* Meta — pinned bottom-left */}
            <div className="iv-meta" onClick={stopProp}>
                <div className="iv-avatar">{avatarLetter}</div>
                <div className="iv-sender-info">
                    <span className="iv-sender-name">{sender}</span>
                    <span className="iv-time">{formattedTime}</span>
                </div>
            </div>

            {/* Zoom controls — pinned bottom-right */}
            <div className="iv-zoom-controls" onClick={stopProp}>
                <button className="iv-zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
                <button className="iv-zoom-btn iv-zoom-reset" onClick={zoomReset} title="Reset zoom">1:1</button>
                <button className="iv-zoom-btn" onClick={zoomOut} title="Zoom out">−</button>
            </div>
        </div>,
        document.body
    );
}
