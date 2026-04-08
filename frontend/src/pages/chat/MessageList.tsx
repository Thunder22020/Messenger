import { useRef, useState, useEffect, useCallback, type MutableRefObject } from "react";
import type { RefObject } from "react";
import { useLongPress } from "../../hooks/useLongPress";
import type { AttachmentDto, DateGroup, Message, PendingFile, UploadingBubble } from "./chatTypes";
import { formatMessageTime, formatFileSize, fileExtension, formatSystemContent } from "./chatFormat";
import { useLanguage } from "../../context/LanguageContext";

const IMAGE_CORNER_R = 13; // bubble outer radius (16) minus bubble padding (3)

function getImageBorderRadius(
  rowIdx: number,
  colIdx: number,
  totalRows: number,
  rowSize: number,
  hasTextBelow: boolean
): string {
  const r = IMAGE_CORNER_R;
  const tl = rowIdx === 0 && colIdx === 0 ? r : 0;
  const tr = rowIdx === 0 && colIdx === rowSize - 1 ? r : 0;
  const br = rowIdx === totalRows - 1 && colIdx === rowSize - 1 && !hasTextBelow ? r : 0;
  const bl = rowIdx === totalRows - 1 && colIdx === 0 && !hasTextBelow ? r : 0;
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) return "0";
  return `${tl}px ${tr}px ${br}px ${bl}px`;
}

function buildAttachmentRows(count: number): number[] {
  if (count === 1) return [1];
  if (count === 2) return [2];
  if (count === 3) return [1, 2];
  if (count === 4) return [2, 2];
  return [2, 3];
}

function distributeIntoRows<T>(items: T[], rowSizes: number[]): T[][] {
  const rows: T[][] = [];
  let i = 0;
  for (const size of rowSizes) {
    rows.push(items.slice(i, i + size));
    i += size;
  }
  return rows;
}

function AttachmentGrid({ photos, onImageClick, hasTextBelow = false, onImageLoad }: { photos: AttachmentDto[]; onImageClick: (index: number) => void; hasTextBelow?: boolean; onImageLoad?: () => void }) {
  const rows = distributeIntoRows(photos, buildAttachmentRows(photos.length));
  const totalRows = rows.length;

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.classList.add("img-loaded");
    img.parentElement?.classList.add("img-loaded");
    onImageLoad?.();
  };

  return (
    <div className={`attachment-grid${photos.length === 1 ? " single" : ""}`}>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="attachment-row">
          {row.map((att, colIdx) => (
            <div
              key={att.id}
              className="attachment-img-wrapper"
              style={{ borderRadius: getImageBorderRadius(rowIdx, colIdx, totalRows, row.length, hasTextBelow) }}
            >
              <img
                src={att.url}
                alt={att.fileName}
                className="message-image"
                onLoad={handleLoad}
                onClick={() => onImageClick(photos.indexOf(att))}
                draggable={false}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const MAX_SINGLE_W = 280;
const MAX_SINGLE_H = 320;

function singleImageSize(nw: number, nh: number): { width: number; height: number } {
  const scale = Math.min(MAX_SINGLE_W / nw, MAX_SINGLE_H / nh, 1);
  return { width: Math.round(nw * scale), height: Math.round(nh * scale) };
}

function VideoAttachmentList({ videos, onVideoClick }: { videos: AttachmentDto[]; onVideoClick: (index: number) => void }) {
  return (
    <div className="video-attachment-list">
      {videos.map((v, i) => (
        <div key={v.id} className="message-video-thumb" onClick={(e) => { e.stopPropagation(); onVideoClick(i); }}>
          <video src={v.url} preload="metadata" className="message-video" muted />
          <div className="message-video-play-icon" />
        </div>
      ))}
    </div>
  );
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const draggingRef = useRef(false);
  const currentRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onMeta = () => setDuration(isFinite(audio.duration) ? audio.duration : 0);
    const onTime = () => { if (!draggingRef.current) setCurrent(audio.currentTime); };
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const onSeekStart = () => { draggingRef.current = true; };

  const onSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    currentRef.current = val;
    setCurrent(val);
  };

  const commitSeek = () => {
    draggingRef.current = false;
    if (audioRef.current) audioRef.current.currentTime = currentRef.current;
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="audio-player" onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={src} preload="metadata" crossOrigin="anonymous" />
      <button className="audio-play-btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <rect x="4" y="3" width="4" height="14" rx="1.5" />
            <rect x="12" y="3" width="4" height="14" rx="1.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M5 3.5l12 6.5-12 6.5V3.5z" />
          </svg>
        )}
      </button>
      <div className="audio-controls">
        <input
          type="range"
          className="audio-seek"
          min={0}
          max={duration || 100}
          step={0.05}
          value={current}
          onMouseDown={onSeekStart}
          onTouchStart={onSeekStart}
          onChange={onSeekChange}
          onMouseUp={commitSeek}
          onTouchEnd={commitSeek}
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
        />
        <div className="audio-time">
          <span>{fmtTime(current)}</span>
          <span>{fmtTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

function AudioAttachmentList({ audios }: { audios: AttachmentDto[] }) {
  return (
    <div className="audio-attachment-list">
      {audios.map((a) => <AudioPlayer key={a.id} src={a.url} />)}
    </div>
  );
}

const NUM_PEAKS = 50;
const MIN_BAR_H = 3;

function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  progress: number,
  isMine: boolean,
  shimmerPos?: number,  // 0–1 sweep position; undefined = not loading
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || peaks.length === 0) return;
  const W = canvas.width;
  const H = canvas.height;
  const N = peaks.length;
  const gap = 2;
  const barW = Math.max(2, Math.floor((W - (N - 1) * gap) / N));
  const totalW = N * barW + (N - 1) * gap;
  const offsetX = Math.floor((W - totalW) / 2);

  const isLight = document.documentElement.dataset.theme === 'light';
  // Light theme: mine=dark espresso bg → light bars; other=near-white bg → dark bars
  // Dark theme:  mine=cream bg         → dark bars;  other=dark bg       → light bars
  const wantLight = isLight ? isMine : !isMine;
  const colorPlayed   = wantLight ? "rgba(234,224,210,0.90)" : "rgba(25,22,15,0.80)";
  const colorUnplayed = wantLight ? "rgba(234,224,210,0.28)" : "rgba(25,22,15,0.22)";

  ctx.clearRect(0, 0, W, H);

  for (let i = 0; i < N; i++) {
    const barH = Math.max(MIN_BAR_H, Math.round(peaks[i] * (H - 4)));
    const x = offsetX + i * (barW + gap);
    const y = Math.floor((H - barH) / 2);
    const r = Math.min(barW / 2, 2);

    if (shimmerPos !== undefined) {
      // Per-bar shimmer: brightness pulse travels across bars
      const barCenter = (x + barW / 2) / W;
      const dist = Math.abs(barCenter - shimmerPos);
      const glow = Math.max(0, 1 - dist / 0.25);
      const [baseA, peakA] = wantLight ? [0.18, 0.65] : [0.13, 0.52];
      const a = (baseA + glow * (peakA - baseA)).toFixed(2);
      ctx.fillStyle = wantLight ? `rgba(234,224,210,${a})` : `rgba(25,22,15,${a})`;
    } else {
      ctx.fillStyle = i / N < progress ? colorPlayed : colorUnplayed;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, r);
    ctx.fill();
  }
}

function VoiceMessageBubble({ src, isMine, time }: { src: string; isMine: boolean; time: string }) {
  const audioRef    = useRef<HTMLAudioElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number | null>(null);
  const peaksRef    = useRef<number[]>([]);
  const durationRef = useRef(0);  // mirrors duration state, readable inside RAF closures

  const loadedRef    = useRef(false);
  const shimmerPosRef = useRef(0);

  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);   // seconds elapsed, drives display
  const [duration, setDuration] = useState(0);   // total duration, set from decode

  const setDurationSynced = useCallback((d: number) => {
    durationRef.current = d;
    setDuration(d);
  }, []);

  // Draw with an explicit progress value (0-1) — no hidden state
  const draw = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas || peaksRef.current.length === 0) return;
    drawWaveform(canvas, peaksRef.current, progress, isMine, loadedRef.current ? undefined : shimmerPosRef.current);
  }, [isMine]);

  // Keep canvas pixel dimensions in sync with CSS layout
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sync = () => {
      if (canvas.offsetWidth > 0) {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const audio = audioRef.current;
        const dur = durationRef.current;
        const p = audio && dur > 0 ? audio.currentTime / dur : 0;
        draw(p);
      }
    };
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    sync();
    return () => ro.disconnect();
  }, [draw]);

  // RAF loop — runs while playing, drives both canvas and time display
  const startRAF = useCallback(() => {
    const loop = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const dur = durationRef.current;
      const p = dur > 0 ? audio.currentTime / dur : 0;
      setCurrent(audio.currentTime);
      draw(p);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  const stopRAF = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Decode audio → amplitude peaks + duration (no need to wait for loadedmetadata)
  useEffect(() => {
    let cancelled = false;

    // Seed placeholder bars immediately so the waveform and RAF progress are
    // visible before the async decode finishes (Chrome re-downloads via fetch
    // due to partitioned cache, so decode can take several seconds).
    peaksRef.current = Array(NUM_PEAKS).fill(0.5);
    draw(0);

    async function decode() {
      try {
        const res     = await fetch(src, { cache: "no-store" });
        const buf     = await res.arrayBuffer();
        // OfflineAudioContext is not subject to Chrome's autoplay-policy
        // suspension that can silently abort decodeAudioData on a regular
        // AudioContext created without a user gesture.
        const audioCtx = new OfflineAudioContext(1, 44100, 44100);
        const decoded  = await audioCtx.decodeAudioData(buf);
        if (cancelled) return;

        const data = decoded.getChannelData(0);  // no close() — OfflineAudioContext is GC'd automatically
        const step = Math.floor(data.length / NUM_PEAKS);
        const ps: number[] = [];
        for (let i = 0; i < NUM_PEAKS; i++) {
          let max = 0;
          const end = Math.min((i + 1) * step, data.length);
          for (let j = i * step; j < end; j++) max = Math.max(max, Math.abs(data[j]));
          ps.push(max);
        }
        const maxPeak = Math.max(...ps, 0.001);
        peaksRef.current = ps.map(p => p / maxPeak);

        setDurationSynced(decoded.duration);
        loadedRef.current = true;
        const audio = audioRef.current;
        const p = audio && decoded.duration > 0 ? audio.currentTime / decoded.duration : 0;
        draw(p);
      } catch {
        if (!cancelled) {
          peaksRef.current = Array(NUM_PEAKS).fill(0.5);
          loadedRef.current = true;
          draw(0);
        }
      }
    }
    decode();
    return () => { cancelled = true; };
  }, [src, draw]);

  // loadedmetadata: fallback duration if decode hasn't fired yet
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onMeta  = () => {
      if (isFinite(audio.duration) && audio.duration > 0 && durationRef.current === 0) {
        setDurationSynced(audio.duration);
      }
    };
    const onEnded = () => {
      stopRAF();
      setPlaying(false);
      setCurrent(0);
      if (audio) audio.currentTime = 0;
      draw(0);
    };
    audio.addEventListener("loadedmetadata", onMeta);
    // Race-condition guard: metadata may have already loaded before this effect ran
    if (audio.readyState >= 1 && isFinite(audio.duration) && audio.duration > 0 && durationRef.current === 0) {
      setDurationSynced(audio.duration);
    }
    audio.addEventListener("ended",          onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended",          onEnded);
    };
  }, [draw, stopRAF]);

  useEffect(() => () => stopRAF(), [stopRAF]);

  // Shimmer animation — runs until decode completes
  useEffect(() => {
    const cycleDuration = 1400;
    const startTime = performance.now();
    let rafId: number;
    const animate = (now: number) => {
      if (loadedRef.current) return;
      shimmerPosRef.current = ((now - startTime) % cycleDuration) / cycleDuration;
      draw(0);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [draw]);

  // Redraw when theme changes so waveform colors update immediately
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const audio = audioRef.current;
      const dur = durationRef.current;
      const p = audio && dur > 0 ? audio.currentTime / dur : 0;
      draw(p);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [draw]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      stopRAF();
    } else {
      audio.play();
      setPlaying(true);
      startRAF();
    }
  };

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    const dur = durationRef.current;
    if (!audio || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p    = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = p * dur;
    setCurrent(audio.currentTime);
    draw(p);
  };

  // Before any playback: show total duration. During/after seek: show elapsed.
  const displayTime = current > 0 ? fmtTime(current) : fmtTime(duration);

  return (
    <div className="voice-message-bubble" onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={src} preload="metadata" crossOrigin="anonymous" />
      <div className="voice-bubble-top">
        <button className="audio-play-btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <rect x="4" y="3" width="4" height="14" rx="1.5" />
              <rect x="12" y="3" width="4" height="14" rx="1.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M5 3.5l12 6.5-12 6.5V3.5z" />
            </svg>
          )}
        </button>
        <div className="voice-waveform-wrap">
          <canvas
            ref={canvasRef}
            className="voice-bubble-canvas"
            height={36}
            onClick={onCanvasClick}
          />
        </div>
      </div>
      <div className="voice-bubble-meta">
        <span className="voice-bubble-duration">{displayTime}</span>
        <span className="message-time">{time}</span>
      </div>
    </div>
  );
}

function FileAttachmentList({ files }: { files: AttachmentDto[] }) {
  return (
    <div className="file-attachment-list">
      {files.map((f) => (
        <a
          key={f.id}
          href={f.url}
          download={f.fileName}
          className="file-attachment-card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="file-attachment-icon">{fileExtension(f.fileName)}</div>
          <div className="file-attachment-info">
            <div className="file-attachment-name">{f.fileName}</div>
            <div className="file-attachment-meta">{formatFileSize(f.fileSize)}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

function UploadingAttachmentGrid({ files, progress, hasTextBelow = false }: { files: PendingFile[]; progress: number; hasTextBelow?: boolean }) {
  const isSingle = files.length === 1;
  const rows = distributeIntoRows(files, buildAttachmentRows(files.length));
  const totalRows = rows.length;
  const circumference = 2 * Math.PI * 15;
  return (
    <div className={`attachment-grid${isSingle ? " single" : ""}`}>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="attachment-row">
          {row.map((pf, colIdx) => {
            const br = getImageBorderRadius(rowIdx, colIdx, totalRows, row.length, hasTextBelow);
            const wrapperStyle = isSingle
              ? { borderRadius: br, ...singleImageSize(pf.naturalWidth, pf.naturalHeight) }
              : { borderRadius: br };
            return (
              <div key={pf.localId} className="uploading-image-wrapper" style={wrapperStyle}>
                <img src={pf.previewUrl} alt={pf.file.name} className="message-image uploading" style={{ borderRadius: br }} />
                <div className="upload-progress-overlay">
                  <svg viewBox="0 0 36 36" className="upload-progress-circle">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15" fill="none" stroke="white" strokeWidth="3"
                      strokeDasharray={`${circumference}`}
                      strokeDashoffset={`${circumference * (1 - progress / 100)}`}
                      strokeLinecap="round"
                      style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.2s" }}
                    />
                  </svg>
                  <span className="upload-progress-pct">{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function UploadingFileList({ files, progress }: { files: PendingFile[]; progress: number }) {
  return (
    <div className="file-attachment-list uploading-file-list">
      {files.map((pf) => (
        <div key={pf.localId} className="file-attachment-card uploading-file-card">
          <div className="file-attachment-icon">{fileExtension(pf.file.name)}</div>
          <div className="file-attachment-info">
            <div className="file-attachment-name">{pf.file.name}</div>
            <div className="file-attachment-meta uploading-file-progress">
              <span className="uploading-file-bar-wrap">
                <span className="uploading-file-bar" style={{ width: `${progress}%` }} />
              </span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const SWIPE_THRESHOLD = 50;
const MAX_SWIPE_OFFSET = 72;

interface SwipeState {
  col: HTMLElement;
  row: HTMLElement;
  icon: HTMLElement | null;
  startX: number;
  startY: number;
  locked: 'h' | 'v' | null;
  active: boolean;
  msgId: number;
}

export function MessageList(props: {
  dateGroups: DateGroup[];
  uploadingBubbles: UploadingBubble[];
  chatType: string | null;
  currentUsername: string | null;
  unreadDividerMessageId: number | null | undefined;
  dividerRef: RefObject<HTMLDivElement | null>;
  deletingMessageIds: Set<number>;
  isReadByAnyOther: (messageId: number) => boolean;
  onMessageContextMenu: (x: number, y: number, msg: Message, isMine: boolean) => void;
  onScrollToMessage: (messageId: number) => void;
  onMediaClick: (items: AttachmentDto[], index: number, meta: { sender: string; createdAt: string }) => void;
  onImageLoad?: () => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
  onSwipeReply: (messageId: number) => void;
}) {
  const {
    dateGroups,
    uploadingBubbles,
    chatType,
    currentUsername,
    unreadDividerMessageId,
    dividerRef,
    deletingMessageIds,
    isReadByAnyOther,
    onMessageContextMenu,
    onScrollToMessage,
    onMediaClick,
    onImageLoad,
    onToggleReaction,
    onSwipeReply,
  } = props;
  const { t } = useLanguage();

  const columnRef = useRef<HTMLDivElement>(null);
  const swipeStateRef = useRef<SwipeState | null>(null) as MutableRefObject<SwipeState | null>;
  const onSwipeReplyRef = useRef(onSwipeReply);
  useEffect(() => { onSwipeReplyRef.current = onSwipeReply; }, [onSwipeReply]);

  // Long-press state: which message is being held
  const pendingMsg = useRef<{ msg: Message; isMine: boolean } | null>(null);

  const longPress = useLongPress(
    useCallback((x: number, y: number) => {
      if (!pendingMsg.current) return;
      const { msg, isMine } = pendingMsg.current;
      const cx = Math.min(x, window.innerWidth - 220);
      const cy = Math.min(y, window.innerHeight - 220);
      onMessageContextMenu(cx, cy, msg, isMine);
    }, [onMessageContextMenu])
  );

  const longPressCancelRef = useRef(longPress.cancel);
  useEffect(() => { longPressCancelRef.current = longPress.cancel; }, [longPress.cancel]);

  useEffect(() => {
    const container = columnRef.current;
    if (!container) return;

    const onStart = (e: TouchEvent) => {
      const bubble = (e.target as HTMLElement).closest('.message-bubble') as HTMLElement | null;
      if (!bubble) return;
      const col = bubble.closest('.message-bubble-col') as HTMLElement | null;
      if (!col) return;
      const dataRow = bubble.closest('[data-message-id]') as HTMLElement | null;
      if (!dataRow) return;
      const msgId = parseInt((dataRow as HTMLElement).dataset.messageId ?? '', 10);
      if (isNaN(msgId)) return;
      const messageRow = bubble.closest('.message-row') as HTMLElement | null;
      if (!messageRow) return;
      const icon = messageRow.querySelector('.swipe-reply-icon') as HTMLElement | null;
      const t = e.touches[0];
      swipeStateRef.current = { col, row: messageRow, icon, startX: t.clientX, startY: t.clientY, locked: null, active: false, msgId };
    };

    const onMove = (e: TouchEvent) => {
      const sw = swipeStateRef.current;
      if (!sw) return;
      const t = e.touches[0];
      const dx = t.clientX - sw.startX;
      const dy = t.clientY - sw.startY;

      if (!sw.locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        sw.locked = dx < 0 && Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        if (sw.locked === 'v') { swipeStateRef.current = null; return; }
      }

      e.preventDefault();

      if (!sw.active) {
        sw.active = true;
        sw.row.style.overflow = 'visible';
        longPressCancelRef.current();
      }

      const offset = Math.max(-MAX_SWIPE_OFFSET, Math.min(0, dx));
      sw.col.style.transform = `translateX(${offset}px)`;
      sw.col.style.transition = 'none';

      if (sw.icon) {
        const progress = Math.min(1, Math.abs(offset) / SWIPE_THRESHOLD);
        sw.icon.style.opacity = String(progress);
        sw.icon.style.transform = `translateY(-50%) scale(${0.7 + 0.3 * progress})`;
      }
    };

    const onEnd = (e: TouchEvent) => {
      const sw = swipeStateRef.current;
      swipeStateRef.current = null;
      if (!sw?.active) return;

      const t = e.changedTouches[0];
      const offset = Math.abs(Math.min(0, t.clientX - sw.startX));

      sw.col.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      sw.col.style.transform = 'translateX(0)';
      sw.col.addEventListener('transitionend', () => {
        sw.col.style.transition = '';
        sw.col.style.transform = '';
        sw.row.style.overflow = '';
      }, { once: true });

      if (sw.icon) {
        sw.icon.style.opacity = '0';
        sw.icon.style.transform = 'translateY(-50%) scale(0.7)';
      }

      if (offset >= SWIPE_THRESHOLD) {
        navigator.vibrate?.(30);
        onSwipeReplyRef.current(sw.msgId);
      }
    };

    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', onEnd, { passive: true });
    container.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', onEnd);
      container.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return (
    <div className="messages-column" ref={columnRef}>
      {dateGroups.map((dateGroup) => (
        <div key={dateGroup.dateKey} className="date-section">
          <div className="date-separator">
            <span className="date-pill">{dateGroup.label}</span>
          </div>

          {dateGroup.senderGroups.map((group) => {
            const isMine = group.sender === currentUsername;
            const showGroupDivider =
              unreadDividerMessageId != null &&
              group.messages.some((m) => m.id === unreadDividerMessageId);

            return (
              <div key={group.messages[0].id}>
                {showGroupDivider && (
                  <div ref={dividerRef} className="unread-messages-divider">
                    <span className="unread-messages-divider-label">{t("chat.unreadMessages")}</span>
                  </div>
                )}

                <div className={`message-group ${isMine ? "mine" : "other"}`}>
                  {!isMine && chatType === "GROUP" && (
                    <div className="group-sender-label">{group.sender}</div>
                  )}

                  {group.messages.map((msg, msgIdx) => {
                    if (msg.type === "SYSTEM") {
                      return (
                        <div key={msg.id} className="system-message">
                          {formatSystemContent(msg.content)}
                        </div>
                      );
                    }

                    const isLast = msgIdx === group.messages.length - 1;
                    const formattedTime = formatMessageTime(msg.createdAt);
                    const showUnreadDot = isMine && !isReadByAnyOther(msg.id);
                    const isVoice = msg.type === "VOICE";
                    const photos = msg.attachments?.filter(a => a.type === "PHOTO") ?? [];
                    const videos = msg.attachments?.filter(a => a.type === "VIDEO") ?? [];
                    const mediaItems = msg.attachments?.filter(a => a.type === "PHOTO" || a.type === "VIDEO") ?? [];
                    const audios = isVoice ? [] : (msg.attachments?.filter(a => a.type === "AUDIO") ?? []);
                    const fileDtos = msg.attachments?.filter(a => a.type === "FILE") ?? [];
                    const hasMedia = photos.length > 0;
                    const hasVideos = videos.length > 0;
                    const hasAudios = audios.length > 0;
                    const hasFiles = fileDtos.length > 0;
                    const isVideoOnly = hasVideos && !msg.content && !hasMedia && !hasAudios && !hasFiles;
                    const isMediaOnly = hasMedia && !msg.content && !hasVideos && !hasAudios && !hasFiles;
                    const voiceAttachment = isVoice ? (msg.attachments?.find(a => a.type === "AUDIO") ?? null) : null;

                    return (
                      <div
                        key={msg.id}
                        data-message-id={msg.id}
                        className={`message-row-collapse${
                          deletingMessageIds.has(msg.id) ? " collapsing" : ""
                        }`}
                      >
                        <div className={`message-row ${isMine ? "mine" : "other"}`}>
                          {!isMine && chatType === "GROUP" && (
                            isLast ? (
                              <div className="message-avatar">
                                {group.sender.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <div className="message-avatar-spacer" />
                            )
                          )}

                          {isMine && (
                            <div
                              className={`unread-dot${
                                showUnreadDot ? " visible" : ""
                              }`}
                            />
                          )}

                          <div className="message-bubble-col">
                          <div
                            className={`message-bubble${isVoice ? " voice-bubble" : isMediaOnly || isVideoOnly ? " media-only" : hasMedia || hasVideos ? " has-media" : ""}`}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              const cx = Math.min(e.clientX, window.innerWidth - 220);
                              const cy = Math.min(e.clientY, window.innerHeight - 220);
                              onMessageContextMenu(cx, cy, msg, isMine);
                            }}
                            onTouchStart={(e) => {
                              pendingMsg.current = { msg, isMine };
                              longPress.onTouchStart(e);
                            }}
                            onTouchMove={longPress.onTouchMove}
                            onTouchEnd={longPress.onTouchEnd}
                            onTouchCancel={longPress.onTouchCancel}
                            onClick={longPress.onClick}
                          >
                            {msg.replyPreview && (
                              <div
                                className="message-reply-preview"
                                onClick={() =>
                                  onScrollToMessage(msg.replyPreview!.messageId)
                                }
                              >
                                <div className="reply-preview-sender">
                                  {msg.replyPreview.sender}
                                </div>
                                <div className="reply-preview-content">
                                  {msg.replyPreview.content ||
                                    (msg.replyPreview.attachmentType === "PHOTO" ? "📷 Photo" :
                                     msg.replyPreview.attachmentType === "VIDEO" ? "🎥 Video" :
                                     msg.replyPreview.attachmentType === "AUDIO" ? "🎧 Audio" :
                                     msg.replyPreview.attachmentType === "FILE" ? "📄 File" :
                                     "Deleted message")}
                                </div>
                              </div>
                            )}

                            {isVoice && voiceAttachment ? (
                              <VoiceMessageBubble
                                src={voiceAttachment.url}
                                isMine={isMine}
                                time={formattedTime}
                              />
                            ) : (
                              <>
                                {hasMedia && (
                                  <div className="attachment-grid-wrapper">
                                    <AttachmentGrid
                                      photos={photos}
                                      onImageClick={(i) => onMediaClick(mediaItems, mediaItems.indexOf(photos[i]), { sender: msg.sender, createdAt: msg.createdAt })}
                                      hasTextBelow={!isMediaOnly}
                                      onImageLoad={onImageLoad}
                                    />
                                    {isMediaOnly && (
                                      <div className="message-meta-overlay">
                                        {msg.editedAt && (
                                          <span className="message-edited-icon" role="img" aria-label="edited" />
                                        )}
                                        <span className="message-time">{formattedTime}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {hasVideos && (
                                  <VideoAttachmentList
                                    videos={videos}
                                    onVideoClick={(j) => onMediaClick(mediaItems, mediaItems.indexOf(videos[j]), { sender: msg.sender, createdAt: msg.createdAt })}
                                  />
                                )}

                                {hasAudios && (
                                  <AudioAttachmentList audios={audios} />
                                )}

                                {hasFiles && (
                                  <FileAttachmentList files={fileDtos} />
                                )}

                                {!isMediaOnly && (
                                  <div className="message-content">
                                    <span className="message-text">{msg.content}</span>
                                    <span className="message-time">
                                      {msg.editedAt && (
                                        <span className="message-edited-icon" role="img" aria-label="edited" />
                                      )}
                                      {formattedTime}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="reaction-row">
                              {[...msg.reactions]
                                .sort((a, b) => {
                                  if (b.count !== a.count) return b.count - a.count;
                                  if (a.reactedByMe !== b.reactedByMe) return a.reactedByMe ? -1 : 1;
                                  return 0;
                                })
                                .map(r => (
                                <button
                                  key={r.emoji}
                                  className={`reaction-chip${r.reactedByMe ? " reacted" : ""}`}
                                  onClick={() => onToggleReaction(msg.id, r.emoji)}
                                  type="button"
                                >
                                  {r.emoji} <span className="reaction-count">{r.count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          </div>
                          <div className="swipe-reply-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                              <polyline points="9 17 4 12 9 7"/>
                              <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {uploadingBubbles.map((bubble) => {
        const hasImages = bubble.files.some(f => f.isImage);
        const hasFiles = bubble.files.length > 0 && !hasImages;
        const isMediaOnly = hasImages && !bubble.content;
        return (
          <div key={bubble.tempId} className="message-group mine">
            <div className="message-row-collapse">
              <div className="message-row mine">
                <div className={`message-bubble${isMediaOnly ? " media-only" : hasImages ? " has-media" : ""}`}>
                  {bubble.replyPreview && (
                    <div className="message-reply-preview">
                      <div className="reply-preview-sender">{bubble.replyPreview.sender}</div>
                      <div className="reply-preview-content">
                        {bubble.replyPreview.content || "Deleted message"}
                      </div>
                    </div>
                  )}

                  {hasImages && (
                    <div className="attachment-grid-wrapper">
                      <UploadingAttachmentGrid files={bubble.files} progress={bubble.progress} hasTextBelow={!isMediaOnly} />
                      {isMediaOnly && (
                        <div className="message-meta-overlay">
                          <span className="message-time">sending…</span>
                        </div>
                      )}
                    </div>
                  )}

                  {hasFiles && (
                    <UploadingFileList files={bubble.files} progress={bubble.progress} />
                  )}

                  {!isMediaOnly && (
                    <div className="message-content">
                      <span className="message-text">{bubble.content}</span>
                      <span className="message-time">sending…</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
