"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "warning" | "info";

export interface ToastPayload {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastRecord extends ToastPayload {
  id: string;
  tone: ToastTone;
  state: "entering" | "open" | "closing";
}

interface ToastContextValue {
  push: (payload: ToastPayload) => void;
  success: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const toneIcon: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-pine shrink-0" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4 text-terracotta shrink-0" aria-hidden="true" />,
  info: <Info className="h-4 w-4 text-ink-muted shrink-0" aria-hidden="true" />,
};

const toneBorder: Record<ToastTone, string> = {
  success: "border-pine/30",
  warning: "border-terracotta/35",
  info: "border-border-default",
};

/**
 * Calm, interruptible toast stack inspired by Sonner:
 * pauses dismissal while hovered or when the browser tab is hidden.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const pausedRef = React.useRef(false);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, state: "closing" } : item,
      ),
    );
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 240);
  }, []);

  const push = React.useCallback(
    ({ title, description, tone = "info", durationMs = 4200 }: ToastPayload) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [
        ...prev.slice(-3),
        { id, title, description, tone, state: "entering" },
      ]);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setToasts((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, state: "open" } : item,
            ),
          );
        });
      });

      const scheduleClose = (remaining: number) => {
        window.setTimeout(() => {
          if (pausedRef.current || document.hidden) {
            scheduleClose(800);
            return;
          }
          dismiss(id);
        }, remaining);
      };

      scheduleClose(durationMs);
    },
    [dismiss],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push({ title, description, tone: "success" }),
      warning: (title, description) => push({ title, description, tone: "warning" }),
      info: (title, description) => push({ title, description, tone: "info" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-state={toast.state}
            role="status"
            className={cn(
              "toast-item pointer-events-auto bg-surface border rounded-xl px-4 py-3.5 flex items-start gap-3",
              toneBorder[toast.tone],
            )}
          >
            <div className="mt-0.5">{toneIcon[toast.tone]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink leading-snug">
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="pressable focus-ring -mr-1 -mt-0.5 h-6 w-6 rounded-md flex items-center justify-center text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
