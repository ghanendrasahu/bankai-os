import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon.js";

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`spinner ${className}`.trimEnd()} aria-hidden="true" />;
}

/** Screen block shown while a view resolves. */
export function Skeleton() {
  return (
    <div className="loading-page" aria-hidden="true">
      <span className="skeleton line" style={{ width: 220 }} />
      <span className="skeleton line" style={{ width: "64%" }} />
      <span className="skeleton line" style={{ width: "90%" }} />
      <span className="skeleton line" style={{ width: "78%" }} />
      <span className="skeleton line" style={{ width: "38%" }} />
    </div>
  );
}

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className="empty" style={compact ? { padding: "28px 16px" } : undefined}>
      <Icon name={icon} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="row">{action}</div>}
    </div>
  );
}
