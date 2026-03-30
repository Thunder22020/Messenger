export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
}

export function formatMessageTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot !== -1 ? fileName.slice(dot + 1).toUpperCase() : "FILE";
}

export function formatSystemContent(content: string | null | undefined): string {
  if (!content) return "";
  if (content.startsWith("call_ended:")) {
    const seconds = parseInt(content.split(":")[1], 10);
    if (!isNaN(seconds) && seconds > 0) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `📞 Call ended · ${m}:${s.toString().padStart(2, "0")}`;
    }
    return "📞 Call ended";
  }
  if (content.startsWith("call_missed:")) {
    const caller = content.split(":")[1];
    return caller ? `📵 Missed call from ${caller}` : "📵 Missed call";
  }
  if (content === "call_missed") {
    return "📵 Missed call";
  }
  if (content.startsWith("call_rejected:")) {
    const caller = content.split(":")[1];
    return caller ? `📵 Cancelled call from ${caller}` : "📵 Cancelled call";
  }
  return content;
}

export function formatShortDate(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDay.getTime() === today.getTime()) return formatMessageTime(createdAt);
  if (msgDay.getTime() === yesterday.getTime()) return "Yesterday";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${date.getFullYear()}`;
}

