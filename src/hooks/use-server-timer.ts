"use client";

import * as React from "react";

export interface UseServerTimerOptions {
  serverNowIso: string;
  deadlineAtIso: string;
  active: boolean;
  onExpire: () => void;
}

/**
 * Monotonic server-synchronized countdown timer.
 * Anchors remaining time to `serverNow + elapsed performance.now()`, so
 * shifting the device's system clock mid-exam never alters remaining time.
 */
export function useServerTimer({
  serverNowIso,
  deadlineAtIso,
  active,
  onExpire,
}: UseServerTimerOptions) {
  const deadlineMs = React.useMemo(
    () => new Date(deadlineAtIso).getTime(),
    [deadlineAtIso],
  );

  const [remainingMs, setRemainingMs] = React.useState<number>(() =>
    Math.max(0, deadlineMs - new Date(serverNowIso).getTime()),
  );

  const anchorRef = React.useRef<{ serverMs: number; perfMs: number } | null>(
    null,
  );
  const expiredRef = React.useRef(false);
  const onExpireRef = React.useRef(onExpire);

  React.useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const syncServerClock = React.useCallback((nextServerNowIso: string) => {
    const serverMs = new Date(nextServerNowIso).getTime();
    if (!Number.isFinite(serverMs)) return;
    anchorRef.current = {
      serverMs,
      perfMs: performance.now(),
    };
    const nextRemaining = Math.max(0, deadlineMs - serverMs);
    setRemainingMs(nextRemaining);
  }, [deadlineMs]);

  React.useEffect(() => {
    if (!active) return;

    anchorRef.current = {
      serverMs: new Date(serverNowIso).getTime(),
      perfMs: performance.now(),
    };
    expiredRef.current = false;

    const tick = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const elapsed = Math.max(0, performance.now() - anchor.perfMs);
      const estimatedServerNow = anchor.serverMs + elapsed;
      const next = Math.max(0, deadlineMs - estimatedServerNow);
      setRemainingMs(next);

      if (next === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [active, serverNowIso, deadlineMs]);

  return {
    remainingMs,
    syncServerClock,
  };
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
