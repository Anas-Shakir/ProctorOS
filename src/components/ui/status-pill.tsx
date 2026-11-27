"use client";

import * as React from "react";
import { Check, Loader2, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

export type NetworkSyncState =
  | "saved"
  | "saving"
  | "offline"
  | "reconnecting";

const stateMeta: Record<
  NetworkSyncState,
  {
    label: string;
    classes: string;
    icon: React.ReactNode;
  }
> = {
  saved: {
    label: "Saved",
    classes: "bg-pine-tint text-pine border-pine/20",
    icon: <Check className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  saving: {
    label: "Saving...",
    classes: "bg-subtle text-ink-muted border-border-default",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />,
  },
  offline: {
    label: "Offline, answers stored locally",
    classes: "bg-terracotta-tint text-terracotta border-terracotta/25",
    icon: <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  reconnecting: {
    label: "Reconnecting...",
    classes: "bg-terracotta-tint text-terracotta border-terracotta/25",
    icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />,
  },
};

/** Persistent network-aware indicator with subtle blur-crossfade state transitions. */
export function StatusPill({
  state,
  className,
}: {
  state: NetworkSyncState;
  className?: string;
}) {
  const current = stateMeta[state];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition-colors duration-200",
        current.classes,
        className,
      )}
    >
      <span
        key={state}
        className="inline-flex items-center gap-1.5 blur-swap-enter"
      >
        {current.icon}
        <span>{current.label}</span>
      </span>
    </div>
  );
}
