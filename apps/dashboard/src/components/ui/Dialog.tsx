import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.js";
import { IconButton } from "./Button.js";

/**
 * Accessible modal dialog: focus is trapped while open, Escape closes,
 * the previously focused element is restored on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    const first = focusables?.[0];
    if (first instanceof HTMLElement) first.focus();
    else panel?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel) {
        const list = panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
        );
        if (list.length === 0) return;
        const firstEl = list[0]!;
        const lastEl = list[list.length - 1]!;
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // lock scroll behind the overlay
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={wide ? "dialog wide" : "dialog"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="dialog-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="dialog-sub">{subtitle}</p>}
          </div>
          <IconButton icon="close" label="Close dialog" onClick={onClose} />
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmation dialog (replaces window.confirm). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  danger,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? "btn primary" : "btn primary"}
            style={danger ? { background: "var(--danger)", color: "#1a0d10" } : undefined}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <span className="spinner sm" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="alert" style={{ alignItems: "center" }}>
        <Icon name={danger ? "alert" : "shield"} />
        <div className="alert-body">{body}</div>
      </div>
    </Dialog>
  );
}

/** Convenience: confirm with loading state. */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    body: React.ReactNode;
    confirmLabel: string;
    danger: boolean;
    onConfirm: (() => Promise<void>) | null;
    busy: boolean;
  }>({
    open: false,
    title: "",
    body: null,
    confirmLabel: "Confirm",
    danger: false,
    onConfirm: null,
    busy: false,
  });

  const ask = useCallback(
    (options: {
      title: string;
      body: React.ReactNode;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => Promise<void>;
    }) => {
      setState((s) => ({
        ...s,
        open: true,
        title: options.title,
        body: options.body,
        confirmLabel: options.confirmLabel,
        danger: options.danger ?? false,
        onConfirm: options.onConfirm,
        busy: false,
      }));
    },
    []
  );

  const close = useCallback(() => setState((s) => ({ ...s, open: false, busy: false })), []);
  const confirm = useCallback(async () => {
    const fn = state.onConfirm;
    if (!fn) return;
    setState((s) => ({ ...s, busy: true }));
    try {
      await fn();
      setState((s) => ({ ...s, open: false, busy: false }));
    } catch {
      setState((s) => ({ ...s, open: false, busy: false }));
    }
  }, [state.onConfirm]);

  const element = (
    <ConfirmDialog
      open={state.open}
      onClose={close}
      onConfirm={() => void confirm()}
      title={state.title}
      body={state.body}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      busy={state.busy}
    />
  );

  return { ask, element };
}
