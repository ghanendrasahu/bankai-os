import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { IconButton } from "./Button.js";

/** Labeled field wrapper (label + control + hint/error). */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function TextInput({
  className = "",
  reveal,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { reveal?: boolean }) {
  const [shown, setShown] = useState(false);
  return reveal ? (
    <div className="input-wrap">
      <input
        {...rest}
        type={shown ? "text" : "password"}
        className={`input ${className}`}
        autoComplete={rest.autoComplete ?? "off"}
      />
      <IconButton
        icon={shown ? "eye-off" : "eye"}
        label={shown ? "Hide value" : "Reveal value"}
        onClick={() => setShown((v) => !v)}
      />
    </div>
  ) : (
    <input {...rest} className={`input ${className}`} />
  );
}

export function TextArea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`textarea ${className}`} />;
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`select ${className}`}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={`check ${className}`}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="switch" title={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
      />
      <span className="track" />
      <span className="thumb" />
    </label>
  );
}
