import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon.js";
import { IconButton } from "./Button.js";

export type ToastKind = "ok" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  leaving: boolean;
}

const ToastCtx = createContext<{
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
} | null>(null);

const ICONS: Record<ToastKind, Parameters<typeof Icon>[0]["name"]> = {
  ok: "check",
  error: "alert",
  info: "shield",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 220);
  }, []);

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, text, leaving: false }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 6500 : 3800);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (text: string) => push("ok", text),
      error: (text: string) => push("error", text),
      info: (text: string) => push("info", text),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}${t.leaving ? " leaving" : ""}`}>
            <Icon name={ICONS[t.kind]} />
            <span className="msg">{t.text}</span>
            <IconButton
              icon="close"
              label="Dismiss notification"
              size="sm"
              className="close-btn"
              onClick={() => dismiss(t.id)}
            />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
