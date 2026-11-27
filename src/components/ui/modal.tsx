"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/**
 * Centered dialog entering from scale(0.95) + opacity: 0 (never scale(0)).
 * Animates via CSS transitions so rapid open/close stays interruptible.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const [rendered, setRendered] = React.useState(open);
  const [visible, setVisible] = React.useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (open) {
      let innerRaf = 0;
      const outerRaf = requestAnimationFrame(() => {
        setRendered(true);
        innerRaf = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outerRaf);
        cancelAnimationFrame(innerRaf);
      };
    }

    const closeRaf = requestAnimationFrame(() => setVisible(false));
    const timeout = window.setTimeout(() => setRendered(false), 220);
    return () => {
      cancelAnimationFrame(closeRaf);
      window.clearTimeout(timeout);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!rendered) return null;

  const state = visible ? "open" : "closed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div
        data-state={state}
        onClick={onClose}
        aria-hidden="true"
        className="modal-backdrop fixed inset-0 bg-ink/25"
      />
      <div
        data-state={state}
        className={cn(
          "modal-panel relative z-10 w-full bg-surface border border-border-default rounded-xl",
          sizeClasses[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 sm:px-7">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-ink tracking-[-0.015em]"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1.5 text-sm text-ink-muted leading-relaxed"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="pressable focus-ring -mr-1.5 -mt-1.5 h-8 w-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 pb-6 sm:px-7">{children}</div>

        {footer && (
          <div className="px-6 py-4 sm:px-7 border-t border-border-default flex items-center justify-end gap-3 bg-canvas/60 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
