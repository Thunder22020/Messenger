import { useCallback, useRef } from "react";

const LONG_PRESS_DELAY = 500;
const MOVE_THRESHOLD = 8; // px — cancel if finger moves more than this (user is scrolling)

/**
 * Returns touch event handlers that fire `onLongPress(x, y)` after the user
 * holds their finger in place for LONG_PRESS_DELAY ms.
 * Cancels if the finger moves (scroll) or lifts early.
 */
export function useLongPress(onLongPress: (x: number, y: number) => void) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startPos = useRef<{ x: number; y: number } | null>(null);
    const fired = useRef(false);

    const clear = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        startPos.current = null;
    }, []);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        fired.current = false;
        const touch = e.touches[0];
        startPos.current = { x: touch.clientX, y: touch.clientY };
        timerRef.current = setTimeout(() => {
            fired.current = true;
            timerRef.current = null;
            navigator.vibrate?.(50);
            onLongPress(touch.clientX, touch.clientY);
        }, LONG_PRESS_DELAY);
    }, [onLongPress]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!startPos.current) return;
        const t = e.touches[0];
        if (
            Math.abs(t.clientX - startPos.current.x) > MOVE_THRESHOLD ||
            Math.abs(t.clientY - startPos.current.y) > MOVE_THRESHOLD
        ) {
            clear();
        }
    }, [clear]);

    // Prevent the click that follows touchend from also firing after a long press
    const onClick = useCallback((e: React.MouseEvent) => {
        if (fired.current) {
            e.preventDefault();
            e.stopPropagation();
            fired.current = false;
        }
    }, []);

    return { onTouchStart, onTouchMove, onTouchEnd: clear, onTouchCancel: clear, onClick };
}
