import * as React from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "pine" | "terracotta" | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  icon?: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-subtle text-ink-muted border-border-default",
  pine: "bg-pine-tint text-pine border-pine/20",
  terracotta: "bg-terracotta-tint text-terracotta border-terracotta/25",
  outline: "bg-surface text-ink border-border-default",
};

/** Semantic flat status badge. Always pair with label/icon rather than color alone. */
export function Badge({
  className,
  variant = "neutral",
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium tracking-[0.01em] whitespace-nowrap",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
