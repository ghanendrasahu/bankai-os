/**
 * Inline SVG icon set — consistent 24×24 grid, 1.8 stroke, round joins.
 * Hand-authored so there is no icon-font or component-library dependency.
 */

export type IconName =
  | "overview"
  | "chat"
  | "agents"
  | "runs"
  | "tasks"
  | "memory"
  | "settings"
  | "plus"
  | "edit"
  | "trash"
  | "stop"
  | "send"
  | "refresh"
  | "close"
  | "check"
  | "alert"
  | "chevron-down"
  | "chevron-right"
  | "key"
  | "shield"
  | "terminal"
  | "eye"
  | "eye-off"
  | "copy"
  | "search"
  | "lock"
  | "menu"
  | "arrow-down"
  | "arrow-right"
  | "wrench"
  | "clock"
  | "spinner"
  | "zap"
  | "database"
  | "message";

const PATHS: Record<IconName, string> = {
  overview:
    "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  chat:
    "M21 12a8 8 0 0 1-8 8H4l1.8-3.1A8 8 0 1 1 21 12z",
  agents:
    "M12 2.5 13.2 5h-2.4L12 2.5z" /* placeholder replaced below */,
  runs:
    "M3 12h4l2.5-7 4 14 2.5-7H21",
  tasks:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" ,
  memory:
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  settings:
    "M4 6h10M18 6h2M4 12h2M10 12h10M4 18h13M20 18h0",
  plus: "M12 5v14M5 12h14",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
  trash: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6",
  stop: "M7 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  send: "M12 19V5M5 12l7-7 7 7",
  refresh:
    "M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6",
  close: "M18 6 6 18M6 6l12 12",
  check: "M4 12.5 9.5 18 20 6.5",
  alert:
    "M12 3 1.8 20.2h20.4L12 3z M12 9v5M12 17.5v.5",
  "chevron-down": "m6 9 6 6 6-6",
  "chevron-right": "m9 6 6 6-6 6",
  key: "M15.5 9.5a3.5 3.5 0 1 0-3.4-4.4M12.1 5.1 4 13.2V17h3.8l8.1-8.1M21.5 8a5.5 5.5 0 1 1-9.4-3.9 5.5 5.5 0 0 1 9.4 3.9z",
  shield: "M12 3 4.5 6v5.2c0 4.7 3.2 8.1 7.5 9.8 4.3-1.7 7.5-5.1 7.5-9.8V6L12 3z",
  terminal: "M5 8l4 4-4 4M12 17h7M3.5 4h17A1.5 1.5 0 0 1 22 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5v-13A1.5 1.5 0 0 1 3.5 4z",
  eye: "M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  "eye-off":
    "M4 4l16 16M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A16.3 16.3 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.7M9.9 9.9a3 3 0 1 0 4.2 4.2",
  copy:
    "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4",
  lock: "M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M8 11V7a4 4 0 0 1 8 0v4",
  menu: "M4 6h16M4 12h16M4 18h16",
  "arrow-down": "M12 5v14M5 12l7 7 7-7",
  "arrow-right": "M5 12h14M12 5l7 7-7 7",
  wrench:
    "M14.7 6.3a4.5 4.5 0 0 0-6 5.4L3.5 17l3.6 3.6 5.3-5.3a4.5 4.5 0 0 0 5.4-5.9l-2.9 2.8-2.7-.6-.6-2.7 3.1-2.6z",
  clock: "M12 7v5l3 3M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  spinner: "M12 3a9 9 0 1 0 9 9",
  zap: "M13 2 4 14h6l-1 8 9-12h-6l1-8z",
  database:
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  message: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z",
};

/** agents gets a custom composed path (bot) since it is multiple elements. */
const AGENT_ICON = (
  <>
    <rect x="4.5" y="8" width="15" height="11" rx="2.5" />
    <path d="M12 8V4M12 4h3M9 13h.01M15 13h.01M9.5 16.5h5" />
  </>
);

const TASKS_ICON = PATHS.clock;

export function Icon({
  name,
  className,
  size,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  const px = size ? `${size}px` : undefined;
  const common = {
    className: className ? `icon ${className}` : "icon",
    width: px,
    height: px,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
  } as const;

  if (name === "agents") {
    return <svg {...common}>{AGENT_ICON}</svg>;
  }
  if (name === "tasks") {
    // clock with hands
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
  }
  return <svg {...common}><path d={PATHS[name]} /></svg>;
}
