"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  LayoutGrid,
  Megaphone,
  NotebookPen,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DEFAULT_WORKSPACE_PREFS,
  type WorkspacePrefs,
} from "@/lib/validators/prefs";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Modal,
  StatusPill,
  useToast,
} from "@/components/ui";
import {
  useAttemptAutosave,
  type LocalAnswerState,
} from "@/hooks/use-attempt-autosave";
import { formatCountdown, useServerTimer } from "@/hooks/use-server-timer";
import { cn } from "@/lib/cn";

export interface PaperQuestionItem {
  attemptQuestionId: string;
  position: number;
  type: "SINGLE" | "MULTI" | "WRITTEN";
  marks: number;
  text: string;
  options: Array<{ id: string; text: string }>;
  answer: {
    selectedOptionIds: string[];
    writtenText: string | null;
    markedForReview: boolean;
    revision: number;
    savedAt: string;
  } | null;
}

export interface InitialPaperPayload {
  attempt: {
    id: string;
    examId: string;
    examTitle: string;
    instructions: string;
    totalMarks: number;
    durationMin: number;
    status: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | "GRADED";
    isSandbox: boolean;
    startedAt: string;
    deadlineAt: string;
    submittedAt: string | null;
  };
  serverNow: string;
  questions: PaperQuestionItem[];
  scratchpad: {
    content: string;
    updatedAt: string | null;
  };
}

function isQuestionAnswered(ans: LocalAnswerState | undefined): boolean {
  if (!ans) return false;
  return (
    ans.selectedOptionIds.length > 0 || ans.writtenText.trim().length > 0
  );
}

export function AttemptWorkspace({
  initialPaper,
  initialPrefs = DEFAULT_WORKSPACE_PREFS,
}: {
  initialPaper: InitialPaperPayload;
  initialPrefs?: WorkspacePrefs;
}) {
  const router = useRouter();
  const toast = useToast();

  const [status, setStatus] = React.useState(initialPaper.attempt.status);
  const [submittedAt, setSubmittedAt] = React.useState<string | null>(
    initialPaper.attempt.submittedAt,
  );
  const isActive = status === "IN_PROGRESS";

  const [prefs, setPrefs] = React.useState<WorkspacePrefs>(initialPrefs);
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [restartingSandbox, setRestartingSandbox] = React.useState(false);

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, LocalAnswerState>>(
    () => {
      const initial: Record<string, LocalAnswerState> = {};
      for (const q of initialPaper.questions) {
        initial[q.attemptQuestionId] = {
          selectedOptionIds: q.answer?.selectedOptionIds ?? [],
          writtenText: q.answer?.writtenText ?? "",
          markedForReview: q.answer?.markedForReview ?? false,
          revision: q.answer?.revision ?? 0,
        };
      }
      return initial;
    },
  );
  const [scratchpadText, setScratchpadText] = React.useState(
    initialPaper.scratchpad.content,
  );
  const [scratchpadOpen, setScratchpadOpen] = React.useState(false);
  const [noticesOpen, setNoticesOpen] = React.useState(false);
  const [announcements, setAnnouncements] = React.useState<
    Array<{ id: string; message: string; authorName: string; createdAt: string }>
  >([]);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [submitModalOpen, setSubmitModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const seenAnnouncementIdsRef = React.useRef<Set<string> | null>(null);

  const answersRef = React.useRef(answers);
  React.useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submittingRef = React.useRef(false);

  const handleFinalizedRemote = React.useCallback(() => {
    setStatus((prev) => (prev === "IN_PROGRESS" ? "AUTO_SUBMITTED" : prev));
    toast.warning(
      "Attempt finalized",
      "The submission deadline has been reached.",
    );
    router.refresh();
  }, [router, toast]);

  const syncClockRef = React.useRef<(iso: string) => void>(() => {});

  const {
    syncState,
    queueAnswer,
    queueScratchpad,
    flushOutbox,
    clearOutbox,
  } = useAttemptAutosave({
    attemptId: initialPaper.attempt.id,
    active: isActive,
    onServerSync: (iso) => syncClockRef.current(iso),
    onFinalized: handleFinalizedRemote,
    onRecoverOutbox: (stored) => {
      setAnswers((prev) => {
        const next = { ...prev };
        for (const [qId, queued] of Object.entries(stored.answers)) {
          const existing = next[qId];
          if (!existing || queued.revision > existing.revision) {
            next[qId] = {
              selectedOptionIds: queued.selectedOptionIds,
              writtenText: queued.writtenText,
              markedForReview: queued.markedForReview,
              revision: queued.revision,
            };
          }
        }
        return next;
      });
      if (stored.scratchpad?.dirty) {
        setScratchpadText(stored.scratchpad.content);
      }
    },
  });

  const executeSubmit = React.useCallback(
    async (isAuto = false) => {
      if (submittingRef.current || status !== "IN_PROGRESS") return;
      submittingRef.current = true;
      setSubmitting(true);

      try {
        if (!isAuto) {
          await flushOutbox();
        }
        const res = await fetch(
          `/api/attempts/${initialPaper.attempt.id}/submit`,
          { method: "POST" },
        );
        const data = await res.json();
        if (!res.ok) {
          toast.warning(
            "Submission notice",
            data.error ?? "Unable to submit right now.",
          );
          return;
        }
        clearOutbox();
        setStatus(data.attempt.status);
        setSubmittedAt(data.attempt.submittedAt);
        setSubmitModalOpen(false);
        toast.success(
          isAuto ? "Time expired — attempt auto-submitted" : "Exam submitted",
          "Your saved answers have been recorded.",
        );
        router.refresh();
      } catch {
        toast.warning(
          "Network error",
          "Could not reach server to submit. Please retry.",
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [
      clearOutbox,
      flushOutbox,
      initialPaper.attempt.id,
      router,
      status,
      toast,
    ],
  );

  const { remainingMs, syncServerClock } = useServerTimer({
    serverNowIso: initialPaper.serverNow,
    deadlineAtIso: initialPaper.attempt.deadlineAt,
    active: isActive,
    onExpire: () => {
      void executeSubmit(true);
    },
  });

  React.useEffect(() => {
    syncClockRef.current = syncServerClock;
  }, [syncServerClock]);

  // Lightweight event capture hooks (neutral telemetry, never auto-penalizing)
  React.useEffect(() => {
    if (!isActive) return;

    const sendEvent = (
      type: "TAB_HIDDEN" | "BLUR" | "PASTE",
      detail?: string,
    ) => {
      fetch(`/api/attempts/${initialPaper.attempt.id}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, detail }),
      }).catch(() => {
        // Ignore network errors during telemetry
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        sendEvent("TAB_HIDDEN", "Browser tab hidden during attempt");
      }
    };

    const onBlur = () => {
      sendEvent("BLUR", "Window focus moved away from exam");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [initialPaper.attempt.id, isActive]);

  // Poll examiner announcements every 10s while attempt is active
  React.useEffect(() => {
    if (!isActive) return;

    const pollAnnouncements = async () => {
      try {
        const res = await fetch(
          `/api/attempts/${initialPaper.attempt.id}/announcements`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          announcements: Array<{
            id: string;
            message: string;
            authorName: string;
            createdAt: string;
          }>;
        };
        const list = data.announcements ?? [];
        setAnnouncements(list);

        if (seenAnnouncementIdsRef.current === null) {
          seenAnnouncementIdsRef.current = new Set(list.map((a) => a.id));
        } else {
          for (const item of list) {
            if (!seenAnnouncementIdsRef.current.has(item.id)) {
              seenAnnouncementIdsRef.current.add(item.id);
              toast.info("Announcement from Examiner", item.message);
            }
          }
        }
      } catch {
        // Ignore transient polling error
      }
    };

    void pollAnnouncements();
    const id = window.setInterval(() => {
      if (!document.hidden) {
        void pollAnnouncements();
      }
    }, 10_000);

    return () => window.clearInterval(id);
  }, [initialPaper.attempt.id, isActive, toast]);

  // Keyboard navigation (N / P / ArrowLeft / ArrowRight) — instant, zero animation
  React.useEffect(() => {
    if (!isActive || submitModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCurrentIndex((prev) =>
          Math.min(initialPaper.questions.length - 1, prev + 1),
        );
      } else if (
        event.key === "ArrowLeft" ||
        event.key.toLowerCase() === "p"
      ) {
        event.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [initialPaper.questions.length, isActive, submitModalOpen]);

  const updateQuestionAnswer = (
    attemptQuestionId: string,
    updater: (prev: LocalAnswerState) => Omit<LocalAnswerState, "revision">,
    immediate = false,
  ) => {
    if (!isActive) return;
    const prev = answersRef.current[attemptQuestionId] ?? {
      selectedOptionIds: [],
      writtenText: "",
      markedForReview: false,
      revision: 0,
    };
    const nextFields = updater(prev);
    const nextEntry: LocalAnswerState = {
      ...nextFields,
      revision: prev.revision + 1,
    };

    setAnswers((state) => ({
      ...state,
      [attemptQuestionId]: nextEntry,
    }));

    queueAnswer(
      {
        attemptQuestionId,
        ...nextEntry,
      },
      immediate,
    );
  };

  const updateWorkspacePrefs = async (patch: Partial<WorkspacePrefs>) => {
    const next: WorkspacePrefs = { ...prefs, ...patch };
    setPrefs(next);
    try {
      window.localStorage.setItem("proctoros_prefs", JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
    try {
      await fetch("/api/user/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      // Non-blocking preference sync
    }
  };

  const handleRestartSandbox = async () => {
    if (!initialPaper.attempt.isSandbox) return;
    setRestartingSandbox(true);
    try {
      clearOutbox();
      await fetch(
        `/api/examiner/exams/${initialPaper.attempt.examId}/sandbox`,
        { method: "DELETE" },
      );
      const res = await fetch(
        `/api/examiner/exams/${initialPaper.attempt.examId}/sandbox`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Restart failed", data.error ?? "Could not restart sandbox");
        setRestartingSandbox(false);
        return;
      }
      router.push(`/candidate/attempts/${data.attempt.id}`);
      router.refresh();
    } catch {
      toast.warning("Network error", "Could not restart sandbox attempt.");
      setRestartingSandbox(false);
    }
  };

  const themeVars: React.CSSProperties | undefined =
    prefs.theme === "dark"
      ? ({
          "--bg-canvas": "#161B18",
          "--bg-surface": "#1F2621",
          "--bg-subtle": "#27302A",
          "--border-default": "#333D36",
          "--border-strong": "#46534A",
          "--ink-primary": "#EEF2EE",
          "--ink-secondary": "#A6B2AA",
          "--accent-primary-tint": "#233627",
          "--accent-secondary-tint": "#3D241C",
        } as React.CSSProperties)
      : undefined;

  const promptSizeClass =
    prefs.fontSize === "sm"
      ? "text-sm leading-relaxed"
      : prefs.fontSize === "lg"
        ? "text-lg sm:text-[19px] leading-[1.7]"
        : "text-base sm:text-[17px] leading-[1.65]";

  // Submission Receipt View
  if (!isActive) {
    return (
      <div
        style={themeVars}
        className="min-h-screen bg-canvas text-ink px-6 py-16"
      >
        <div className="mx-auto max-w-xl">
          <Card className="stagger-in">
            <CardHeader>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-pine-tint text-pine mb-3">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="pine">{status}</Badge>
                {initialPaper.attempt.isSandbox && (
                  <Badge variant="terracotta">Sandbox Preview</Badge>
                )}
              </div>
              <CardTitle className="mt-4 font-serif text-2xl font-medium">
                {initialPaper.attempt.examTitle}
              </CardTitle>
              <CardDescription>
                {initialPaper.attempt.isSandbox
                  ? "Sandbox mode. Nothing is saved to real results."
                  : status === "AUTO_SUBMITTED"
                    ? "The exam deadline expired and your previously saved answers were automatically submitted."
                    : "Your attempt has been submitted cleanly. Results will appear on your dashboard once published by the examiner."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border-default bg-canvas p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Status</span>
                  <span className="font-mono text-xs font-medium text-ink">
                    {status}
                  </span>
                </div>
                {submittedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Recorded at</span>
                    <span className="font-mono text-xs text-ink tabular-nums">
                      {new Date(submittedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {initialPaper.attempt.isSandbox ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/examiner/exams/${initialPaper.attempt.examId}`}
                    className="pressable focus-ring inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border-default bg-surface text-ink text-sm font-medium hover:border-border-strong"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Back to Examiner Workspace</span>
                  </Link>
                  <Button
                    variant="primary"
                    loading={restartingSandbox}
                    loadingLabel="Restarting..."
                    onClick={() => void handleRestartSandbox()}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>Reset &amp; Restart Sandbox</span>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/candidate"
                    className="pressable focus-ring inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border-default bg-surface text-ink text-sm font-medium hover:border-border-strong"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    href={`/candidate/attempts/${initialPaper.attempt.id}/results`}
                    className="pressable focus-ring inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-hover"
                  >
                    <span>View Results</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const questions = initialPaper.questions;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion
    ? answers[currentQuestion.attemptQuestionId]
    : undefined;

  const answeredCount = questions.filter((q) =>
    isQuestionAnswered(answers[q.attemptQuestionId]),
  ).length;
  const flaggedCount = questions.filter(
    (q) => answers[q.attemptQuestionId]?.markedForReview,
  ).length;
  const unansweredCount = questions.length - answeredCount;

  const isUrgent = remainingMs <= 60_000;
  const isWarning = remainingMs > 60_000 && remainingMs <= 5 * 60_000;

  return (
    <div
      style={themeVars}
      className="min-h-screen flex flex-col bg-canvas text-ink"
    >
      {initialPaper.attempt.isSandbox && (
        <div className="bg-terracotta-tint border-b border-terracotta/25 px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-terracotta">
          <span>Sandbox mode. Nothing is saved to real results.</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={restartingSandbox}
              onClick={() => void handleRestartSandbox()}
              className="underline hover:opacity-80 cursor-pointer disabled:opacity-50"
            >
              {restartingSandbox ? "Restarting..." : "Reset & Restart"}
            </button>
            <Link
              href={`/examiner/exams/${initialPaper.attempt.examId}`}
              className="underline hover:opacity-80"
            >
              Exit Preview
            </Link>
          </div>
        </div>
      )}

      {/* Persistent Exam Top Bar */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border-default">
        <div className="mx-auto max-w-6xl px-3 sm:px-8 h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <span className="h-8 w-8 rounded-lg bg-pine text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-ink truncate">
                {initialPaper.attempt.examTitle}
              </p>
              <p className="hidden sm:block text-[11px] text-ink-muted">
                Recorded events active · {answeredCount}/{questions.length}{" "}
                answered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="hidden md:block">
              <StatusPill state={syncState} />
            </div>

            {/* Monotonic Server-Synced Countdown */}
            <div
              aria-label="Time remaining"
              className={cn(
                "inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border font-mono text-xs sm:text-sm font-semibold tabular-nums transition-colors duration-200",
                isUrgent
                  ? "bg-terracotta text-white border-terracotta"
                  : isWarning
                    ? "bg-terracotta-tint text-terracotta border-terracotta/30"
                    : "bg-canvas text-ink border-border-default",
              )}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{formatCountdown(remainingMs)}</span>
            </div>

            <Button
              variant={noticesOpen ? "primary" : "secondary"}
              size="sm"
              aria-label="Exam announcements"
              onClick={() => setNoticesOpen(true)}
            >
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                Notices{announcements.length > 0 ? ` (${announcements.length})` : ""}
              </span>
            </Button>

            <Button
              variant={scratchpadOpen ? "primary" : "secondary"}
              size="sm"
              aria-label="Toggle scratchpad"
              onClick={() => setScratchpadOpen((v) => !v)}
            >
              <NotebookPen className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Scratchpad</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
              aria-label="Display preferences"
              onClick={() => setPrefsOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="hidden md:inline">Display</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="lg:hidden"
              aria-label="Question navigator"
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setSubmitModalOpen(true)}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Submit</span>
            </Button>
          </div>
        </div>

        {/* Mobile sync status strip */}
        <div className="md:hidden border-t border-border-default px-3 sm:px-4 py-1.5 bg-canvas flex items-center justify-between gap-2">
          <StatusPill state={syncState} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              className="sm:hidden inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted hover:text-ink"
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
              <span>Display</span>
            </button>
            <span className="font-mono text-xs text-ink-muted tabular-nums">
              {answeredCount}/{questions.length} answered
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-8 py-8 sm:py-12">
        {questions.length === 0 ? (
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>No questions in this attempt</CardTitle>
              <CardDescription>
                Contact your examiner if this assessment appears empty.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Primary Question Surface (Zero animation on question switch) */}
            <div className="lg:col-span-8 space-y-6">
              {currentQuestion && (
                <Card>
                  <CardHeader className="border-b border-border-default pb-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-pine tabular-nums">
                          Question {currentIndex + 1} of {questions.length}
                        </span>
                        <Badge variant="outline">
                          {currentQuestion.type === "SINGLE"
                            ? "Single Choice"
                            : currentQuestion.type === "MULTI"
                              ? "Multiple Select"
                              : "Written"}
                        </Badge>
                        <Badge variant="neutral">
                          {currentQuestion.marks} marks
                        </Badge>
                      </div>

                      <Button
                        variant={
                          currentAnswer?.markedForReview
                            ? "danger"
                            : "secondary"
                        }
                        size="sm"
                        onClick={() =>
                          updateQuestionAnswer(
                            currentQuestion.attemptQuestionId,
                            (prev) => ({
                              ...prev,
                              markedForReview: !prev.markedForReview,
                            }),
                            true,
                          )
                        }
                      >
                        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {currentAnswer?.markedForReview
                            ? "Marked for Review"
                            : "Mark for Review"}
                        </span>
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-7 space-y-7">
                    <p
                      className={cn(
                        "text-ink whitespace-pre-wrap",
                        promptSizeClass,
                      )}
                    >
                      {currentQuestion.text}
                    </p>

                    {currentQuestion.type === "WRITTEN" ? (
                      <div className="space-y-2">
                        <label
                          htmlFor={`written-${currentQuestion.attemptQuestionId}`}
                          className="text-xs font-medium text-ink-muted uppercase tracking-[0.04em]"
                        >
                          Your Response
                        </label>
                        <textarea
                          id={`written-${currentQuestion.attemptQuestionId}`}
                          rows={8}
                          value={currentAnswer?.writtenText ?? ""}
                          placeholder="Write your clear, complete response here..."
                          onPaste={() => {
                            fetch(
                              `/api/attempts/${initialPaper.attempt.id}/incidents`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  type: "PASTE",
                                  detail: `Pasted content on question ${currentIndex + 1}`,
                                }),
                              },
                            ).catch(() => {});
                          }}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateQuestionAnswer(
                              currentQuestion.attemptQuestionId,
                              (prev) => ({
                                ...prev,
                                writtenText: val,
                              }),
                            );
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-border-default bg-surface text-sm text-ink leading-relaxed focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine resize-y"
                        />
                      </div>
                    ) : (
                      <div
                        role={
                          currentQuestion.type === "SINGLE"
                            ? "radiogroup"
                            : "group"
                        }
                        aria-label={`Options for question ${currentIndex + 1}`}
                        className="space-y-3"
                      >
                        {currentQuestion.options.map((option) => {
                          const selected =
                            currentAnswer?.selectedOptionIds.includes(
                              option.id,
                            ) ?? false;

                          return (
                            <button
                              key={option.id}
                              type="button"
                              role={
                                currentQuestion.type === "SINGLE"
                                  ? "radio"
                                  : "checkbox"
                              }
                              aria-checked={selected}
                              onClick={() => {
                                updateQuestionAnswer(
                                  currentQuestion.attemptQuestionId,
                                  (prev) => {
                                    if (currentQuestion.type === "SINGLE") {
                                      return {
                                        ...prev,
                                        selectedOptionIds: [option.id],
                                      };
                                    }
                                    const exists =
                                      prev.selectedOptionIds.includes(
                                        option.id,
                                      );
                                    return {
                                      ...prev,
                                      selectedOptionIds: exists
                                        ? prev.selectedOptionIds.filter(
                                            (id) => id !== option.id,
                                          )
                                        : [...prev.selectedOptionIds, option.id],
                                    };
                                  },
                                );
                              }}
                              className={cn(
                                "focus-ring w-full text-left rounded-xl border px-4 py-3.5 flex items-start gap-3.5 cursor-pointer transition-colors duration-150",
                                selected
                                  ? "border-pine bg-pine-tint/70 text-ink"
                                  : "border-border-default bg-surface text-ink hover:border-border-strong hover:bg-canvas/60",
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "mt-0.5 h-5 w-5 shrink-0 flex items-center justify-center border",
                                  currentQuestion.type === "SINGLE"
                                    ? "rounded-full"
                                    : "rounded-md",
                                  selected
                                    ? "bg-pine border-pine text-white"
                                    : "bg-surface border-border-strong",
                                )}
                              >
                                {selected && (
                                  <Check className="h-3 w-3" strokeWidth={2.5} />
                                )}
                              </span>
                              <span className="text-sm sm:text-[15px] leading-relaxed">
                                {option.text}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Previous / Next Controls */}
                    <div className="pt-4 border-t border-border-default flex items-center justify-between gap-4">
                      <Button
                        variant="secondary"
                        disabled={currentIndex === 0}
                        onClick={() =>
                          setCurrentIndex((prev) => Math.max(0, prev - 1))
                        }
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        <span>Previous</span>
                      </Button>

                      <span className="hidden sm:inline text-xs font-mono text-ink-muted">
                        Keys: P / N or ← / →
                      </span>

                      {currentIndex < questions.length - 1 ? (
                        <Button
                          variant="primary"
                          onClick={() =>
                            setCurrentIndex((prev) =>
                              Math.min(questions.length - 1, prev + 1),
                            )
                          }
                        >
                          <span>Next</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => setSubmitModalOpen(true)}
                        >
                          <span>Review &amp; Submit</span>
                          <Send className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar: Question Navigator + Optional Scratchpad */}
            <aside
              className={cn(
                "lg:col-span-4 space-y-6",
                prefs.navigatorSide === "left" ? "lg:order-first" : "lg:order-last",
                mobileNavOpen ? "block" : "hidden lg:block",
              )}
            >
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Question Navigator</CardTitle>
                  <CardDescription>
                    Select any number to jump immediately.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((q, idx) => {
                      const ans = answers[q.attemptQuestionId];
                      const answered = isQuestionAnswered(ans);
                      const flagged = Boolean(ans?.markedForReview);
                      const isCurrent = idx === currentIndex;

                      return (
                        <button
                          key={q.attemptQuestionId}
                          type="button"
                          aria-label={`Question ${idx + 1}${flagged ? ", marked for review" : answered ? ", answered" : ", unanswered"}`}
                          aria-current={isCurrent ? "step" : undefined}
                          onClick={() => {
                            setCurrentIndex(idx);
                            setMobileNavOpen(false);
                          }}
                          className={cn(
                            "focus-ring h-10 rounded-lg border font-mono text-xs font-medium tabular-nums flex items-center justify-center gap-1 cursor-pointer",
                            flagged
                              ? "bg-terracotta-tint border-terracotta/40 text-terracotta"
                              : answered
                                ? "bg-pine-tint border-pine/30 text-pine"
                                : "bg-surface border-border-default text-ink hover:border-border-strong",
                            isCurrent && "ring-2 ring-ink ring-offset-1 ring-offset-surface",
                          )}
                        >
                          <span>{idx + 1}</span>
                          {flagged ? (
                            <Flag className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          ) : answered ? (
                            <Check className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend pairing color + shape */}
                  <div className="pt-3 border-t border-border-default grid grid-cols-2 gap-2 text-xs text-ink-muted">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded bg-pine-tint border border-pine/30 inline-flex items-center justify-center text-pine">
                        <Check className="h-2.5 w-2.5" aria-hidden="true" />
                      </span>
                      <span>Answered ({answeredCount})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded bg-terracotta-tint border border-terracotta/40 inline-flex items-center justify-center text-terracotta">
                        <Flag className="h-2.5 w-2.5" aria-hidden="true" />
                      </span>
                      <span>Review ({flaggedCount})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded bg-surface border border-border-default inline-block" />
                      <span>Unanswered ({unansweredCount})</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {scratchpadOpen && (
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle>Digital Scratchpad</CardTitle>
                      <CardDescription>
                        Private rough notes. Autosaved and never graded.
                      </CardDescription>
                    </div>
                    <button
                      type="button"
                      aria-label="Close scratchpad"
                      onClick={() => setScratchpadOpen(false)}
                      className="pressable focus-ring h-7 w-7 rounded-md flex items-center justify-center text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </CardHeader>
                  <CardContent>
                    <textarea
                      aria-label="Scratchpad notes"
                      rows={7}
                      value={scratchpadText}
                      placeholder="Jot down formulas, steps, or edge cases..."
                      onChange={(e) => {
                        const val = e.target.value;
                        setScratchpadText(val);
                        queueScratchpad(val);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border-default bg-canvas text-sm text-ink leading-relaxed focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine resize-y"
                    />
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>
        )}
      </main>

      {/* Review & Submit Confirmation Modal */}
      <Modal
        open={submitModalOpen}
        onClose={() => !submitting && setSubmitModalOpen(false)}
        title="Review Before Submission"
        description="Submitting locks your attempt immediately and triggers grading."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={submitting}
              onClick={() => setSubmitModalOpen(false)}
            >
              Return to Exam
            </Button>
            <Button
              variant="primary"
              loading={submitting}
              loadingLabel="Submitting..."
              onClick={() => void executeSubmit(false)}
            >
              Confirm Submit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-canvas p-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Answered</span>
              <span className="font-mono font-medium text-pine tabular-nums">
                {answeredCount} / {questions.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Unanswered</span>
              <span className="font-mono font-medium text-ink tabular-nums">
                {unansweredCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Marked for review</span>
              <span className="font-mono font-medium text-terracotta tabular-nums">
                {flaggedCount}
              </span>
            </div>
          </div>

          {(unansweredCount > 0 || flaggedCount > 0) && (
            <div className="rounded-lg border border-terracotta/30 bg-terracotta-tint px-4 py-3 flex items-start gap-2.5 text-xs text-terracotta">
              <AlertTriangle
                className="h-4 w-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                You still have {unansweredCount} unanswered and {flaggedCount}{" "}
                question(s) marked for review.
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Persistent Announcement Tray */}
      <Modal
        open={noticesOpen}
        onClose={() => setNoticesOpen(false)}
        title="Examiner Announcements"
        description="Broadcast updates sent during this examination."
        footer={
          <Button variant="secondary" onClick={() => setNoticesOpen(false)}>
            Close
          </Button>
        }
      >
        {announcements.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            No announcements have been posted for this exam.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border-default bg-canvas px-4 py-3 space-y-1"
              >
                <p className="text-sm text-ink leading-relaxed">
                  {item.message}
                </p>
                <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                  {item.authorName} ·{" "}
                  {new Date(item.createdAt).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Workspace Display Preferences Modal */}
      <Modal
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="Workspace Display"
        description="Customize reading size, theme, and navigator position. Saved to your profile."
        footer={
          <Button variant="primary" onClick={() => setPrefsOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
              Reading Font Size
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["sm", "md", "lg"] as const).map((sz) => (
                <Button
                  key={sz}
                  variant={prefs.fontSize === sz ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => void updateWorkspacePrefs({ fontSize: sz })}
                >
                  {sz === "sm" ? "Compact" : sz === "md" ? "Standard" : "Large"}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
              Theme
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={prefs.theme === "paper" ? "primary" : "secondary"}
                size="sm"
                onClick={() => void updateWorkspacePrefs({ theme: "paper" })}
              >
                Warm Paper
              </Button>
              <Button
                variant={prefs.theme === "dark" ? "primary" : "secondary"}
                size="sm"
                onClick={() => void updateWorkspacePrefs({ theme: "dark" })}
              >
                Dark Slate
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
              Navigator Position
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={
                  prefs.navigatorSide === "left" ? "primary" : "secondary"
                }
                size="sm"
                onClick={() =>
                  void updateWorkspacePrefs({ navigatorSide: "left" })
                }
              >
                Left Sidebar
              </Button>
              <Button
                variant={
                  prefs.navigatorSide === "right" ? "primary" : "secondary"
                }
                size="sm"
                onClick={() =>
                  void updateWorkspacePrefs({ navigatorSide: "right" })
                }
              >
                Right Sidebar
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
