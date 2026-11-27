"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-pine text-white border border-pine hover:bg-pine-hover hover:border-pine-hover",
  secondary:
    "bg-surface text-ink border border-border-default hover:border-border-strong hover:bg-canvas",
  ghost:
    "bg-transparent text-ink-muted border border-transparent hover:text-ink hover:bg-subtle",
  danger:
    "bg-terracotta text-white border border-terracotta hover:bg-terracotta-hover hover:border-terracotta-hover",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg",
};

/** Flat editorial button with tactile press feedback and smooth state transitions. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      loadingLabel,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          "pressable focus-ring inline-flex items-center justify-center font-medium whitespace-nowrap select-none cursor-pointer",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <Loader2
            className="h-4 w-4 animate-spin shrink-0"
            aria-hidden="true"
          />
        )}
        <span
          key={loading ? "loading" : "idle"}
          className="inline-flex items-center gap-2 blur-swap-enter"
        >
          {loading && loadingLabel ? loadingLabel : children}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";
