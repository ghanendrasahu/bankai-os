import type { ReactNode } from "react";
import { Icon } from "./Icon.js";

export type Tone = "ok" | "warn" | "danger" | "info" | "accent" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  ok: "ok",
  warn: "warn",
  danger: "danger",
  info: "info",
  accent: "accent",
  neutral: "",
};

export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <span className={`badge ${TONE_CLASS[tone]}`.trimEnd()}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

export function Chip({ tone = "neutral", className = "", children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type="button"
      className={`chip ${tone === "neutral" ? "" : TONE_CLASS[tone]} ${className}`.trimEnd()}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Toggle chip for multi-select groups (aria-pressed carries the state). */
export function ChipSelect({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="chip chip-select" {...rest}>
      {children}
    </button>
  );
}

export function ChipSpan({ tone = "neutral", className = "", children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={`chip ${TONE_CLASS[tone]} ${className}`.trimEnd()}>{children}</span>;
}
