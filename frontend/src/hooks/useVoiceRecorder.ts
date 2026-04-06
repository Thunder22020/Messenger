import { useState, useRef, useEffect, useCallback } from "react";

const MAX_DURATION_MS = 600_000; // 10 minutes
const TICK_INTERVAL_MS = 100;

function pickMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (const type of candidates) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
}

export interface UseVoiceRecorderReturn {
    isRecording: boolean;
    isPaused: boolean;
    isMaxReached: boolean;
    durationMs: number;
    analyserNode: AnalyserNode | null;
    start: () => Promise<void>;
    pause: () => void;
    resume: () => void;
    stop: () => Promise<Blob>;
    cancel: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isMaxReached, setIsMaxReached] = useState(false);
    const [durationMs, setDurationMs] = useState(0);
    const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const mimeTypeRef = useRef<string>("");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const durationRef = useRef(0);
    const stopResolveRef = useRef<((blob: Blob) => void) | null>(null);

    const clearTick = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const startTick = useCallback(() => {
        clearTick();
        intervalRef.current = setInterval(() => {
            durationRef.current += TICK_INTERVAL_MS;
            setDurationMs(durationRef.current);
            if (durationRef.current >= MAX_DURATION_MS) {
                clearTick();
                setIsMaxReached(true);
                mediaRecorderRef.current?.pause();
                setIsRecording(false);
                setIsPaused(true);
            }
        }, TICK_INTERVAL_MS);
    }, [clearTick]);

    const releaseResources = useCallback(() => {
        clearTick();
        mediaRecorderRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        audioContextRef.current?.close();
        audioContextRef.current = null;
        setAnalyserNode(null);
    }, [clearTick]);

    const start = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            setAnalyserNode(analyser);

            mimeTypeRef.current = pickMimeType();
            const mr = new MediaRecorder(stream, mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : undefined);
            mediaRecorderRef.current = mr;
            chunksRef.current = [];

            mr.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mr.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
                stopResolveRef.current?.(blob);
                stopResolveRef.current = null;
            };

            mr.start(100);
            durationRef.current = 0;
            setDurationMs(0);
            setIsRecording(true);
            setIsPaused(false);
            setIsMaxReached(false);
            startTick();
        } catch {
            releaseResources();
        }
    }, [startTick, releaseResources]);

    const pause = useCallback(() => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") return;
        mediaRecorderRef.current.pause();
        clearTick();
        setIsRecording(false);
        setIsPaused(true);
    }, [clearTick]);

    const resume = useCallback(() => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "paused") return;
        if (isMaxReached) return;
        mediaRecorderRef.current.resume();
        setIsRecording(true);
        setIsPaused(false);
        startTick();
    }, [isMaxReached, startTick]);

    const stop = useCallback((): Promise<Blob> => {
        return new Promise((resolve) => {
            stopResolveRef.current = resolve;
            clearTick();
            const mr = mediaRecorderRef.current;
            if (mr && (mr.state === "recording" || mr.state === "paused")) {
                mr.stop();
            } else {
                resolve(new Blob([], { type: "audio/webm" }));
            }
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            audioContextRef.current?.close();
            audioContextRef.current = null;
            setAnalyserNode(null);
            setIsRecording(false);
            setIsPaused(false);
            setIsMaxReached(false);
            setDurationMs(0);
            durationRef.current = 0;
            mediaRecorderRef.current = null;
        });
    }, [clearTick]);

    const cancel = useCallback(() => {
        clearTick();
        const mr = mediaRecorderRef.current;
        if (mr && (mr.state === "recording" || mr.state === "paused")) {
            mr.onstop = null;
            mr.stop();
        }
        releaseResources();
        chunksRef.current = [];
        stopResolveRef.current = null;
        setIsRecording(false);
        setIsPaused(false);
        setIsMaxReached(false);
        setDurationMs(0);
        durationRef.current = 0;
    }, [clearTick, releaseResources]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTick();
            streamRef.current?.getTracks().forEach(t => t.stop());
            audioContextRef.current?.close();
        };
    }, [clearTick]);

    return { isRecording, isPaused, isMaxReached, durationMs, analyserNode, start, pause, resume, stop, cancel };
}
