import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon.js";
import { IconButton } from "./Button.js";

const KIND_ICON: Record<"error" | "info" | "ok" | "warn", IconName> = {
  error: "alert",
  info: "shield",
  ok: "check",
  warn: "alert",
};

export function Alert({
  kind = "info",
  onClose,
  children,
}: {
  kind?: "error" | "info" | "ok" | "warn";
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`alert ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon name={KIND_ICON[kind]} />
      <div className="alert-body">{children}</div>
      {onClose && (
        <IconButton icon="close" label="Dismiss" size="sm" onClick={onClose} />
      )}
    </div>
  );
}
