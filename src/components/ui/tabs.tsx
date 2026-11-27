"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface SegmentedTabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

interface ClipInset {
  left: number;
  right: number;
}

/**
 * Segmented tabs using a clipped active overlay layer (Emil Kowalski clip-path
 * pattern) so text color swaps seamlessly across the Botanical Pine indicator.
 */
export function SegmentedTabs({
  tabs,
  value,
  onChange,
  className,
  ariaLabel = "Sections",
}: SegmentedTabsProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [clip, setClip] = React.useState<ClipInset | null>(null);

  const measure = React.useCallback(() => {
    const container = containerRef.current;
    const activeEl = tabRefs.current[value];
    if (!container || !activeEl) return;

    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return;

    const leftPct = (activeEl.offsetLeft / containerWidth) * 100;
    const rightPct =
      ((containerWidth - (activeEl.offsetLeft + activeEl.offsetWidth)) /
        containerWidth) *
      100;

    setClip({
      left: Math.max(0, leftPct),
      right: Math.max(0, rightPct),
    });
  }, [value]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure, tabs]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  const clipPathValue = clip
    ? `inset(0 ${clip.right.toFixed(2)}% 0 ${clip.left.toFixed(2)}% round 7px)`
    : "inset(0 100% 0 0 round 7px)";

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center p-1 rounded-lg bg-subtle border border-border-default select-none",
        className,
      )}
    >
      {/* Base interactive tab layer */}
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "focus-ring relative z-10 px-3.5 py-1.5 rounded-[7px] text-sm font-medium transition-colors duration-150 cursor-pointer",
              "inline-flex items-center gap-2 whitespace-nowrap",
              isActive ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span className="font-mono text-[11px] tabular-nums opacity-75">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}

      {/* Clipped active Botanical Pine layer */}
      <div
        aria-hidden="true"
        style={{
          clipPath: clipPathValue,
          transition: "clip-path 240ms var(--ease-in-out)",
        }}
        className="pointer-events-none absolute inset-1 z-20 inline-flex items-center bg-pine text-white"
      >
        {tabs.map((tab) => (
          <span
            key={tab.id}
            className="px-3.5 py-1.5 rounded-[7px] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span className="font-mono text-[11px] tabular-nums opacity-90">
                {tab.count}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
