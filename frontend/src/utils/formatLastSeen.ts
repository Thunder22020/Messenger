import type { Lang } from "../i18n/translations";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function formatLastSeen(isoTimestamp: string, lang: Lang, prefix: string): string {
    const ts = new Date(isoTimestamp).getTime();
    const now = Date.now();
    const diff = now - ts;

    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });

    let relative: string;
    if (diff < MINUTE) {
        relative = lang === "ru" ? "только что" : "just now";
    } else if (diff < HOUR) {
        relative = rtf.format(-Math.floor(diff / MINUTE), "minute");
    } else if (diff < DAY) {
        relative = rtf.format(-Math.floor(diff / HOUR), "hour");
    } else {
        // Check if it's calendar-yesterday or older
        const tsDate = new Date(ts);
        const nowDate = new Date(now);
        const tsDay = new Date(tsDate.getFullYear(), tsDate.getMonth(), tsDate.getDate()).getTime();
        const nowDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
        const daysDiff = Math.round((nowDay - tsDay) / DAY);

        if (daysDiff === 1) {
            relative = rtf.format(-1, "day"); // "yesterday" / "вчера"
        } else {
            relative = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" }).format(tsDate);
        }
    }

    return `${prefix} ${relative}`;
}
