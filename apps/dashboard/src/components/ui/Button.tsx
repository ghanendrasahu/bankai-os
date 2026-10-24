import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon.js";

type Variant = "solid" | "primary" | "tonal" | "ghost" | "outline-danger" | "danger";
type Size = "sm" | "md" | "lg";

/** Predictable class mapping for the .btn CSS variants. */
const VARIANT_CLASS: Record<Variant, string> = {
  solid: "",
  primary: "primary",
  tonal: "tonal",
  ghost: "ghost",
  "outline-danger": "outline-danger",
  danger: "danger",
};

const SIZE_CLASS: Record<Size, string> = { sm: "sm", md: "", lg: "lg" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconEnd?: IconName;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "solid",
  size = "md",
  icon,
  iconEnd,
  loading = false,
  block = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = ["btn", VARIANT_CLASS[variant], SIZE_CLASS[size], block ? "block" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="spinner sm" aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} />
      )}
      {children}
      {iconEnd && !loading && <Icon name={iconEnd} />}
    </button>
  );
}

/** Square icon-only button (needs an accessible label). */
export function IconButton({
  icon,
  label,
  className = "",
  size,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: IconName;
  label: string;
  size?: "sm";
}) {
  return (
    <button
      type="button"
      className={size === "sm" ? `icon-btn sm ${className}` : `icon-btn ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
