/** Small formatting helpers shared across the dashboard. */

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** "2m ago"-style relative time; ISO or Date input, "—" for missing. */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 45_000) return "just now";
  if (diff < MIN) return `${Math.round(diff / 1000)}s ago`;
  if (diff < HOUR) return `${Math.round(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h ago`;
  if (diff < 30 * DAY) return `${Math.round(diff / DAY)}d ago`;
  return new Date(t).toLocaleDateString();
}

/** Absolute timestamp for tooltips / dense lists. */
export function absTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

/** Milliseconds between two ISO stamps; null when incomplete. */
export function durationMs(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return e - s;
}

/** Human duration: "1.2s", "3m 41s", "—" when unknown. */
export function fmtDuration(start: string | null | undefined, end: string | null | undefined): string {
  const ms = durationMs(start, end);
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.max(1, Math.round(ms / 100)) * 100}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const m = Math.floor(ms / MIN);
  const s = Math.round((ms % MIN) / 1000);
  return m < 60 ? `${m}m ${s}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** First letters for avatar initials (max 2). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  let chars: string;
  if (parts.length >= 2) {
    chars = (parts[0]!.charAt(0) + parts[1]!.charAt(0)).trim() || name.slice(0, 2);
  } else {
    chars = name.slice(0, 2);
  }
  return chars.toUpperCase() || "?";
}

/** Deterministic hue index for avatar coloring contexts (kept simple — single accent today). */
export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}
