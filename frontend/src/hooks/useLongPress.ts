import { useCallback, useRef } from "react";

const LONG_PRESS_DELAY = 500;
const MOVE_THRESHOLD = 15; // px — increased from 8; natural finger drift is 5-15px

/**
 * Returns touch event handlers that fire `onLongPress(x, y)` after the user
 * holds their finger in place for LONG_PRESS_DELAY ms.
 * Cancels if the finger moves significantly (scroll) or lifts early.
 */
export function useLongPress(onLongPress: (x: number, y: number) => void) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startPos = useRef<{ x: number; y: number } | null>(null);
    const startTime = useRef<number>(0);
    const fired = useRef(false);

    const cancelTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            try { navigator.vibrate?.(0); } catch { /* unsupported */ }
        }
        startPos.current = null;
        startTime.current = 0;
    }, []);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        fired.current = false;
        const touch = e.touches[0];
        startPos.current = { x: touch.clientX, y: touch.clientY };
        startTime.current = Date.now();
        // Schedule vibration from within the touchstart user-gesture context.
        // Pattern: 0ms buzz (noop) → pause LONG_PRESS_DELAY ms → 50ms buzz.
        // Cancelled by vibrate(0) if touch is cancelled early.
        try { navigator.vibrate?.([0, LONG_PRESS_DELAY, 50]); } catch { /* unsupported */ }
        timerRef.current = setTimeout(() => {
            fired.current = true;
            timerRef.current = null;
            startPos.current = null;
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
            cancelTimer();
        }
    }, [cancelTimer]);

    // touchend = user lifted their finger intentionally → always cancel if not yet fired
    const onTouchEnd = useCallback(() => {
        cancelTimer();
    }, [cancelTimer]);

    // touchcancel = browser intervened (scroll detection, system gesture, etc.)
    // If the browser cancels early (< 60% of delay), it's scroll intent → cancel our timer.
    // If it cancels late (≥ 60%), the user was holding — let the timer fire.
    const onTouchCancel = useCallback(() => {
        const elapsed = Date.now() - startTime.current;
        if (elapsed < LONG_PRESS_DELAY * 0.6) {
            cancelTimer();
        } else {
            // Stop touchmove from cancelling (touch sequence is dead anyway),
            // but keep the timer so it fires in the remaining < 200ms.
            startPos.current = null;
        }
    }, [cancelTimer]);

    // Prevent the click that follows touchend from also firing after a long press
    const onClick = useCallback((e: React.MouseEvent) => {
        if (fired.current) {
            e.preventDefault();
            e.stopPropagation();
            fired.current = false;
        }
    }, []);

    return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, onClick };
}
