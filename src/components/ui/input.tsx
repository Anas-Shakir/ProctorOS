import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/** Accessible flat input field with crisp 1px border and Botanical Pine focus state. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-ink tracking-[-0.01em]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [errorId, hintId].filter(Boolean).join(" ") || undefined
          }
          className={cn(
            "w-full h-10 px-3.5 rounded-lg bg-surface text-sm text-ink placeholder:text-ink-muted/70",
            "border transition-colors duration-150 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine",
            "disabled:bg-subtle disabled:text-ink-muted disabled:cursor-not-allowed",
            error
              ? "border-terracotta focus:border-terracotta focus:ring-terracotta/20"
              : "border-border-default hover:border-border-strong",
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-xs text-terracotta font-medium">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/** Accessible multi-line textarea matching Input tokens. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, rows = 4, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const hintId = hint ? `${textareaId}-hint` : undefined;
    const errorId = error ? `${textareaId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-ink tracking-[-0.01em]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [errorId, hintId].filter(Boolean).join(" ") || undefined
          }
          className={cn(
            "w-full px-3.5 py-2.5 rounded-lg bg-surface text-sm text-ink placeholder:text-ink-muted/70",
            "border transition-colors duration-150 ease-out resize-y",
            "focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine",
            "disabled:bg-subtle disabled:text-ink-muted disabled:cursor-not-allowed",
            error
              ? "border-terracotta focus:border-terracotta focus:ring-terracotta/20"
              : "border-border-default hover:border-border-strong",
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-xs text-terracotta font-medium">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
