import { useEffect, useRef } from "react";

interface VoiceRecordingBarProps {
    analyserNode: AnalyserNode | null;
    isRecording: boolean;
    isPaused: boolean;
    durationMs: number;
}

function formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecordingBar({ analyserNode, isRecording, isPaused, durationMs }: VoiceRecordingBarProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyserNode) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isRecording || isPaused) return;

            rafRef.current = requestAnimationFrame(draw);

            const W = canvas.width;
            const H = canvas.height;

            analyserNode.getByteTimeDomainData(dataArray);

            ctx.clearRect(0, 0, W, H);

            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#EAE0D2";
            ctx.beginPath();

            const sliceWidth = W / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * H) / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }

            ctx.lineTo(W, H / 2);
            ctx.stroke();
        };

        draw();

        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [analyserNode, isRecording, isPaused]);

    // Draw flat line when paused or no analyser
    useEffect(() => {
        if (isRecording && !isPaused) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#EAE0D2";
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }, [isRecording, isPaused]);

    return (
        <div className="voice-recording-bar">
            <span className="voice-timer">{formatDuration(durationMs)}</span>
            <span className={`voice-dot${isRecording && !isPaused ? " active" : ""}`} />
            <canvas ref={canvasRef} className="voice-waveform" width={300} height={32} />
        </div>
    );
}
