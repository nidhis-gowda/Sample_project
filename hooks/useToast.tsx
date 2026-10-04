"use client";

import * as React from "react";
import { cn } from "@/utils/cn";

/** Toast queue + provider. Every mutation in the app reports through this. */

export type ToastTone = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = React.useCallback(
    (toast: Omit<Toast, "id">) => {
      counter += 1;
      const id = `toast-${counter}`;
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), toast.tone === "error" ? 8000 : 4500);
      return id;
    },
    [dismiss]
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toasts,
      push,
      dismiss,
      success: (title, description) => push({ tone: "success", title, description }),
      error: (title, description) => push({ tone: "error", title, description }),
      info: (title, description) => push({ tone: "info", title, description }),
    }),
    [toasts, push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    // Rendering outside the provider (e.g. an isolated storybook render) should
    // not crash the page — fall back to a no-op implementation.
    return {
      toasts: [],
      push: () => "",
      success: () => "",
      error: () => "",
      info: () => "",
      dismiss: () => undefined,
    };
  }
  return context;
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-success/30 bg-white text-success-ink",
  error: "border-danger/30 bg-white text-danger-ink",
  warning: "border-warning/30 bg-white text-warning-ink",
  info: "border-info/30 bg-white text-info-ink",
};

const TONE_ICON: Record<ToastTone, string> = {
  success: "bg-success",
  error: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex animate-slide-in items-start gap-3 rounded-xl border p-3.5 shadow-pop",
            TONE_STYLES[toast.tone]
          )}
        >
          <span
            className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", TONE_ICON[toast.tone])}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">{toast.title}</p>
            {toast.description ? (
              <p className="mt-0.5 break-words text-xs text-ink-600">{toast.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            aria-label="Dismiss notification"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}