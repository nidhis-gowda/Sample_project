import * as React from "react";
import { cn } from "@/utils/cn";

/**
 * Form primitives.
 *
 * Every field renders its own label, optional hint and validation message so
 * the pages stay declarative and the error text always matches the API's
 * per-field validation messages.
 */

interface FieldShellProps {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="help-text">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={error ? true : undefined}
      className={cn("input", error ? "input-error" : null, className)}
    />
  );
}

export function Textarea({
  className,
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={error ? true : undefined}
      className={cn("input min-h-[90px] resize-y", error ? "input-error" : null, className)}
    />
  );
}

export function Select({
  className,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={error ? true : undefined}
      className={cn("input", error ? "input-error" : null, className)}
    >
      {children}
    </select>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}

/** Form-level banner, used for non-field errors such as 403/409 responses. */
export function FormAlert({
  tone = "danger",
  title,
  message,
}: {
  tone?: "danger" | "warning" | "info";
  title?: string;
  message: React.ReactNode;
}) {
  const tones = {
    danger: "border-danger/25 bg-danger-soft text-danger-ink",
    warning: "border-warning/25 bg-warning-soft text-warning-ink",
    info: "border-info/25 bg-info-soft text-info-ink",
  } as const;

  return (
    <div className={cn("rounded-lg border px-3.5 py-3 text-sm", tones[tone])} role="alert">
      {title ? <p className="font-semibold">{title}</p> : null}
      {message ? <div className={cn(title && "mt-0.5")}>{message}</div> : null}
    </div>
  );
}

/** Segmented control used for small filter choices. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-ink-300 bg-white p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-[0.4rem] px-3 py-1.5 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-brand-600 text-white shadow-sm"
              : "text-ink-600 hover:bg-ink-100"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}