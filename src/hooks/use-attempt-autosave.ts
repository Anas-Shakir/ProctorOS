"use client";

import * as React from "react";
import type { NetworkSyncState } from "@/components/ui";

export interface LocalAnswerState {
  selectedOptionIds: string[];
  writtenText: string;
  markedForReview: boolean;
  revision: number;
}

interface OutboxAnswerItem extends LocalAnswerState {
  attemptQuestionId: string;
}

interface OutboxStorage {
  answers: Record<string, OutboxAnswerItem>;
  scratchpad?: {
    content: string;
    dirty: boolean;
  };
}

function getStorageKey(attemptId: string): string {
  return `proctoros_outbox_${attemptId}`;
}

export function readOutboxFromStorage(attemptId: string): OutboxStorage {
  if (typeof window === "undefined") {
    return { answers: {} };
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(attemptId));
    if (!raw) return { answers: {} };
    const parsed = JSON.parse(raw) as OutboxStorage;
    return {
      answers: parsed?.answers && typeof parsed.answers === "object"
        ? parsed.answers
        : {},
      scratchpad: parsed?.scratchpad,
    };
  } catch {
    return { answers: {} };
  }
}

function writeOutboxToStorage(attemptId: string, outbox: OutboxStorage) {
  if (typeof window === "undefined") return;
  try {
    const hasAnswers = Object.keys(outbox.answers).length > 0;
    const hasScratch = Boolean(outbox.scratchpad?.dirty);
    if (!hasAnswers && !hasScratch) {
      window.localStorage.removeItem(getStorageKey(attemptId));
    } else {
      window.localStorage.setItem(
        getStorageKey(attemptId),
        JSON.stringify(outbox),
      );
    }
  } catch {
    // Ignore storage quota issues
  }
}

export interface UseAttemptAutosaveOptions {
  attemptId: string;
  active: boolean;
  onServerSync: (serverNowIso: string) => void;
  onFinalized: () => void;
  onRecoverOutbox?: (outbox: OutboxStorage) => void;
}

/**
 * Debounced autosave pipeline backed by a synchronous localStorage outbox.
 * Guarantees zero lost keystrokes on network drops or hard refreshes and
 * replays queued revisions with exponential backoff when connectivity returns.
 */
export function useAttemptAutosave({
  attemptId,
  active,
  onServerSync,
  onFinalized,
  onRecoverOutbox,
}: UseAttemptAutosaveOptions) {
  const [syncState, setSyncState] = React.useState<NetworkSyncState>("saved");

  const outboxRef = React.useRef<OutboxStorage>({ answers: {} });
  const debounceTimerRef = React.useRef<number | null>(null);
  const retryTimerRef = React.useRef<number | null>(null);
  const backoffAttemptRef = React.useRef(0);
  const inFlightFlushRef = React.useRef<Promise<boolean> | null>(null);
  const finalizedNotifiedRef = React.useRef(false);
  const activeRef = React.useRef(active);
  const offlineSinceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const onServerSyncRef = React.useRef(onServerSync);
  const onFinalizedRef = React.useRef(onFinalized);
  const onRecoverRef = React.useRef(onRecoverOutbox);

  React.useEffect(() => {
    onServerSyncRef.current = onServerSync;
    onFinalizedRef.current = onFinalized;
    onRecoverRef.current = onRecoverOutbox;
  }, [onServerSync, onFinalized, onRecoverOutbox]);

  const clearTimers = React.useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const recordOfflineRecoveryIncident = React.useCallback(
    (durationSec: number) => {
      fetch(`/api/attempts/${attemptId}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "OFFLINE",
          detail: `Connection offline for ${durationSec}s; local outbox replayed`,
        }),
      }).catch(() => {
        // Non-blocking telemetry
      });
    },
    [attemptId],
  );

  const flushOutboxRef = React.useRef<() => Promise<boolean>>(async () => true);
  const scheduleRetryRef = React.useRef<() => void>(() => {});

  const scheduleRetry = React.useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }
    const delay = Math.min(
      15000,
      1500 * Math.pow(2, backoffAttemptRef.current),
    );
    backoffAttemptRef.current += 1;
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      if (typeof navigator !== "undefined" && navigator.onLine) {
        setSyncState("reconnecting");
        void flushOutboxRef.current();
      } else {
        scheduleRetryRef.current();
      }
    }, delay);
  }, []);

  React.useEffect(() => {
    scheduleRetryRef.current = scheduleRetry;
  }, [scheduleRetry]);

  const flushOutbox = React.useCallback(async (): Promise<boolean> => {
    if (!activeRef.current) return true;
    if (inFlightFlushRef.current) {
      await inFlightFlushRef.current;
      if (!activeRef.current) return true;
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const pendingAnswers = Object.values(outboxRef.current.answers);
    const pendingScratch = outboxRef.current.scratchpad?.dirty
      ? outboxRef.current.scratchpad
      : null;

    if (pendingAnswers.length === 0 && !pendingScratch) {
      setSyncState("saved");
      return true;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (offlineSinceRef.current === null) {
        offlineSinceRef.current = Date.now();
      }
      setSyncState("offline");
      scheduleRetry();
      return false;
    }

    const runFlush = async (): Promise<boolean> => {
      setSyncState((prev) =>
        prev === "offline" ? "reconnecting" : "saving",
      );

      try {
        while (activeRef.current) {
          const batchAnswers = Object.values(outboxRef.current.answers);
          const batchScratch = outboxRef.current.scratchpad?.dirty
            ? outboxRef.current.scratchpad
            : null;

          if (batchAnswers.length === 0 && !batchScratch) {
            break;
          }

          for (const item of batchAnswers) {
            if (!activeRef.current) return true;
            const res = await fetch(`/api/attempts/${attemptId}/answers`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                attemptQuestionId: item.attemptQuestionId,
                selectedOptionIds: item.selectedOptionIds,
                writtenText: item.writtenText || null,
                markedForReview: item.markedForReview,
                revision: item.revision,
              }),
            });

            if (res.status === 409) {
              const data = await res.json().catch(() => null);
              if (data?.code === "ATTEMPT_FINALIZED") {
                outboxRef.current = { answers: {} };
                writeOutboxToStorage(attemptId, outboxRef.current);
                if (activeRef.current && !finalizedNotifiedRef.current) {
                  finalizedNotifiedRef.current = true;
                  onFinalizedRef.current();
                }
                return false;
              }
            }

            if (!res.ok) {
              throw new Error(`Autosave failed (${res.status})`);
            }

            const data = await res.json();
            if (data?.serverNow) {
              onServerSyncRef.current(data.serverNow);
            }

            // Remove only if no newer revision was queued while request was in flight
            const latestQueued =
              outboxRef.current.answers[item.attemptQuestionId];
            if (latestQueued && latestQueued.revision <= item.revision) {
              delete outboxRef.current.answers[item.attemptQuestionId];
              writeOutboxToStorage(attemptId, outboxRef.current);
            }
          }

          if (batchScratch && activeRef.current) {
            const res = await fetch(`/api/attempts/${attemptId}/scratchpad`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: batchScratch.content }),
            });
            if (res.status === 409) {
              outboxRef.current = { answers: {} };
              writeOutboxToStorage(attemptId, outboxRef.current);
              if (activeRef.current && !finalizedNotifiedRef.current) {
                finalizedNotifiedRef.current = true;
                onFinalizedRef.current();
              }
              return false;
            }
            if (!res.ok) {
              throw new Error(`Scratchpad save failed (${res.status})`);
            }
            if (
              outboxRef.current.scratchpad?.content === batchScratch.content
            ) {
              outboxRef.current.scratchpad = {
                content: batchScratch.content,
                dirty: false,
              };
              writeOutboxToStorage(attemptId, outboxRef.current);
            }
          }
        }

        backoffAttemptRef.current = 0;
        if (offlineSinceRef.current !== null) {
          const durationSec = Math.max(
            1,
            Math.round((Date.now() - offlineSinceRef.current) / 1000),
          );
          offlineSinceRef.current = null;
          recordOfflineRecoveryIncident(durationSec);
        }

        setSyncState("saved");
        return true;
      } catch {
        if (!activeRef.current) return true;
        if (offlineSinceRef.current === null) {
          offlineSinceRef.current = Date.now();
        }
        setSyncState("offline");
        scheduleRetry();
        return false;
      } finally {
        inFlightFlushRef.current = null;
      }
    };

    const promise = runFlush();
    inFlightFlushRef.current = promise;
    return promise;
  }, [attemptId, recordOfflineRecoveryIncident, scheduleRetry]);

  React.useEffect(() => {
    flushOutboxRef.current = flushOutbox;
  }, [flushOutbox]);

  // Recover any unsent localStorage outbox entries on mount and listen to online/offline
  React.useEffect(() => {
    if (!active) return;

    const stored = readOutboxFromStorage(attemptId);
    outboxRef.current = stored;
    if (
      Object.keys(stored.answers).length > 0 ||
      Boolean(stored.scratchpad?.dirty)
    ) {
      onRecoverRef.current?.(stored);
      void flushOutboxRef.current();
    } else if (typeof navigator !== "undefined" && !navigator.onLine) {
      offlineSinceRef.current = Date.now();
      queueMicrotask(() => setSyncState("offline"));
    }

    const handleOffline = () => {
      if (offlineSinceRef.current === null) {
        offlineSinceRef.current = Date.now();
      }
      setSyncState("offline");
    };

    const handleOnline = () => {
      const hasPending =
        Object.keys(outboxRef.current.answers).length > 0 ||
        Boolean(outboxRef.current.scratchpad?.dirty);

      if (hasPending) {
        setSyncState("reconnecting");
        void flushOutboxRef.current();
      } else if (offlineSinceRef.current !== null) {
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - offlineSinceRef.current) / 1000),
        );
        offlineSinceRef.current = null;
        recordOfflineRecoveryIncident(durationSec);
        setSyncState("saved");
      } else {
        setSyncState("saved");
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // 15s heartbeat replay if any queued changes remain
    const heartbeat = window.setInterval(() => {
      const hasPending =
        Object.keys(outboxRef.current.answers).length > 0 ||
        Boolean(outboxRef.current.scratchpad?.dirty);
      if (hasPending && navigator.onLine) {
        void flushOutboxRef.current();
      }
    }, 15_000);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.clearInterval(heartbeat);
      clearTimers();
    };
  }, [active, attemptId, clearTimers, recordOfflineRecoveryIncident]);

  const scheduleDebouncedFlush = React.useCallback(
    (immediate = false) => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (immediate) {
        void flushOutboxRef.current();
        return;
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void flushOutboxRef.current();
      }, 500);
    },
    [],
  );

  const queueAnswer = React.useCallback(
    (item: OutboxAnswerItem, immediate = false) => {
      if (!active) return;
      outboxRef.current.answers[item.attemptQuestionId] = item;
      writeOutboxToStorage(attemptId, outboxRef.current);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (offlineSinceRef.current === null) {
          offlineSinceRef.current = Date.now();
        }
        setSyncState("offline");
        scheduleRetry();
        return;
      }

      setSyncState("saving");
      scheduleDebouncedFlush(immediate);
    },
    [active, attemptId, scheduleDebouncedFlush, scheduleRetry],
  );

  const queueScratchpad = React.useCallback(
    (content: string) => {
      if (!active) return;
      outboxRef.current.scratchpad = { content, dirty: true };
      writeOutboxToStorage(attemptId, outboxRef.current);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (offlineSinceRef.current === null) {
          offlineSinceRef.current = Date.now();
        }
        setSyncState("offline");
        scheduleRetry();
        return;
      }

      setSyncState("saving");
      scheduleDebouncedFlush(false);
    },
    [active, attemptId, scheduleDebouncedFlush, scheduleRetry],
  );

  const clearOutbox = React.useCallback(() => {
    activeRef.current = false;
    clearTimers();
    outboxRef.current = { answers: {} };
    writeOutboxToStorage(attemptId, outboxRef.current);
  }, [attemptId, clearTimers]);

  return {
    syncState,
    queueAnswer,
    queueScratchpad,
    flushOutbox,
    clearOutbox,
  };
}
