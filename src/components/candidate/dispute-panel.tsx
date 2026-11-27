"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileWarning,
  Flag,
  History,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Modal,
  Textarea,
  useToast,
} from "@/components/ui";
import type { CandidateDisputeView } from "@/lib/disputes";

const CATEGORY_LABELS: Record<
  "GRADING_ERROR" | "AMBIGUOUS" | "TECHNICAL",
  string
> = {
  GRADING_ERROR: "Grading error",
  AMBIGUOUS: "Ambiguous question",
  TECHNICAL: "Technical incident",
};

const STATUS_BADGE: Record<
  "OPEN" | "UNDER_REVIEW" | "UPHELD" | "REJECTED",
  { label: string; variant: "neutral" | "outline" | "pine" | "terracotta" }
> = {
  OPEN: { label: "Open", variant: "outline" },
  UNDER_REVIEW: { label: "Under review", variant: "neutral" },
  UPHELD: { label: "Upheld", variant: "pine" },
  REJECTED: { label: "Rejected", variant: "terracotta" },
};

export interface ScoreChangeEvent {
  id: string;
  questionPosition: number;
  previousTotal: number;
  newTotal: number;
  delta: number;
  reason: string | null;
  rulingId: string | null;
  createdAt: string;
}

export function AttemptGradeHistoryPanel({
  originalTotal,
  currentTotal,
  totalMarks,
  events,
}: {
  originalTotal: number;
  currentTotal: number;
  totalMarks: number;
  events: ScoreChangeEvent[];
}) {
  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-4 border-b border-border-default">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-pine" aria-hidden="true" />
            <CardTitle className="text-base">Grade History</CardTitle>
          </div>
          <Badge variant="pine" className="tabular-nums">
            Original {originalTotal} &rarr; Current {currentTotal} / {totalMarks}
          </Badge>
        </div>
        <CardDescription>
          Append-only record of every score update, manual regrade, and question ruling on this attempt.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-2.5">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border-default bg-canvas/70 px-3.5 py-2.5 text-xs"
          >
            <div className="space-y-0.5">
              <p className="font-medium text-ink">
                Q{ev.questionPosition}:{" "}
                <span className="font-mono tabular-nums">
                  {ev.previousTotal} &rarr; {ev.newTotal}
                </span>{" "}
                <span
                  className={
                    ev.delta >= 0
                      ? "font-mono text-pine tabular-nums"
                      : "font-mono text-terracotta tabular-nums"
                  }
                >
                  ({ev.delta >= 0 ? `+${ev.delta}` : ev.delta})
                </span>
              </p>
              {ev.reason && (
                <p className="text-ink-muted">{ev.reason}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ev.rulingId && (
                <Badge variant="outline">Ruling</Badge>
              )}
              <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                {new Date(ev.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function QuestionDisputeControls({
  attemptId,
  attemptQuestionId,
  questionPosition,
  initialDisputes,
}: {
  attemptId: string;
  attemptQuestionId: string;
  questionPosition: number;
  initialDisputes: CandidateDisputeView[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [disputes, setDisputes] =
    React.useState<CandidateDisputeView[]>(initialDisputes);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [evidenceDispute, setEvidenceDispute] =
    React.useState<CandidateDisputeView | null>(null);
  const [category, setCategory] = React.useState<
    "GRADING_ERROR" | "AMBIGUOUS" | "TECHNICAL"
  >("AMBIGUOUS");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const hasActiveDispute = disputes.some(
    (d) => d.status === "OPEN" || d.status === "UNDER_REVIEW",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) {
      toast.warning(
        "Explanation too short",
        "Describe why you are disputing this question (at least 5 characters).",
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/candidate/attempts/${attemptId}/disputes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptQuestionId,
          category,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Dispute refused", data.error ?? "Could not file dispute");
        return;
      }

      const listRes = await fetch(
        `/api/candidate/attempts/${attemptId}/disputes`,
        { cache: "no-store" },
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const mine = (listData.disputes as CandidateDisputeView[]).filter(
          (d) => d.attemptQuestionId === attemptQuestionId,
        );
        setDisputes(mine);
      }

      setModalOpen(false);
      setMessage("");
      toast.success(
        "Dispute filed",
        `Question Q${questionPosition} flagged for examiner review.`,
      );
      router.refresh();
    } catch {
      toast.warning("Network error", "Could not submit dispute.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-3 border-t border-border-default space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">
          Spot a grading mistake, ambiguous option, or technical issue?
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={hasActiveDispute}
          onClick={() => setModalOpen(true)}
        >
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {hasActiveDispute ? "Dispute Active" : `Dispute Q${questionPosition}`}
          </span>
        </Button>
      </div>

      {disputes.map((d) => {
        const badge = STATUS_BADGE[d.status];
        return (
          <div
            key={d.id}
            className="rounded-lg border border-border-default bg-canvas px-4 py-3 space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={badge.variant}
                  icon={
                    d.status === "UPHELD" ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    ) : d.status === "REJECTED" ? (
                      <XCircle className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Clock className="h-3 w-3" aria-hidden="true" />
                    )
                  }
                >
                  {badge.label}
                </Badge>
                <Badge variant="outline">{CATEGORY_LABELS[d.category]}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEvidenceDispute(d)}
                  className="text-xs font-medium text-pine hover:underline"
                >
                  View Evidence Pack
                </button>
                <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                  {new Date(d.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <p className="text-xs text-ink">{d.message}</p>

            {d.resolution && (
              <div className="rounded-md border border-border-default bg-surface px-3 py-2 text-xs">
                <span className="font-medium text-ink">Examiner resolution: </span>
                <span className="text-ink-muted">{d.resolution}</span>
              </div>
            )}
          </div>
        );
      })}

      {/* File Dispute Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`File Dispute for Question Q${questionPosition}`}
        description="Your frozen snapshot, submitted answer, marks awarded, and attempt timeline will be attached automatically as an evidence pack."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={`dispute-form-${attemptQuestionId}`}
              variant="primary"
              loading={submitting}
              loadingLabel="Submitting..."
            >
              Submit Dispute
            </Button>
          </>
        }
      >
        <form
          id={`dispute-form-${attemptQuestionId}`}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor={`cat-${attemptQuestionId}`}
              className="block text-xs font-medium text-ink mb-1.5"
            >
              Issue Category
            </label>
            <select
              id={`cat-${attemptQuestionId}`}
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as "GRADING_ERROR" | "AMBIGUOUS" | "TECHNICAL",
                )
              }
              className="w-full h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pine/40"
            >
              <option value="AMBIGUOUS">Ambiguous question or multiple valid answers</option>
              <option value="GRADING_ERROR">Grading or scoring error</option>
              <option value="TECHNICAL">Technical / connectivity incident</option>
            </select>
          </div>

          <Textarea
            label="Explanation"
            rows={4}
            placeholder="Describe the specific issue with wording, scoring, or technical delivery..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
          />
        </form>
      </Modal>

      {/* Evidence Pack Modal */}
      <Modal
        open={Boolean(evidenceDispute)}
        onClose={() => setEvidenceDispute(null)}
        title={`Evidence Pack — Q${questionPosition}`}
        description="Immutable snapshot and session telemetry attached to this dispute."
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setEvidenceDispute(null)}>
            Close
          </Button>
        }
      >
        {evidenceDispute && (
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-border-default bg-canvas p-3.5 space-y-1.5">
              <p className="font-mono uppercase tracking-[0.05em] text-ink-muted">
                Frozen Question Snapshot ({evidenceDispute.evidence.question.marks} marks)
              </p>
              <p className="text-sm text-ink whitespace-pre-wrap">
                {evidenceDispute.evidence.question.text}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border-default bg-surface p-3.5 space-y-1">
                <p className="font-medium text-ink">Recorded Answer</p>
                <p className="font-mono text-ink-muted">
                  Revision #{evidenceDispute.evidence.answer.revision}
                  {evidenceDispute.evidence.answer.savedAt
                    ? ` · ${new Date(evidenceDispute.evidence.answer.savedAt).toLocaleTimeString()}`
                    : ""}
                </p>
                {evidenceDispute.evidence.question.type === "WRITTEN" ? (
                  <p className="pt-1 text-ink whitespace-pre-wrap">
                    {evidenceDispute.evidence.answer.writtenText || "(Blank)"}
                  </p>
                ) : (
                  <p className="pt-1 text-ink">
                    {evidenceDispute.evidence.answer.selectedOptionIds.length === 0
                      ? "(Unanswered)"
                      : evidenceDispute.evidence.question.options
                          .filter((o) =>
                            evidenceDispute.evidence.answer.selectedOptionIds.includes(
                              o.id,
                            ),
                          )
                          .map((o) => o.text)
                          .join(", ")}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border-default bg-surface p-3.5 space-y-1">
                <p className="font-medium text-ink">Awarded Score &amp; Timeline</p>
                <p className="font-mono text-pine">
                  Current: {evidenceDispute.evidence.awardedScore ?? "Pending"} /{" "}
                  {evidenceDispute.evidence.question.marks} marks
                </p>
                <p className="text-ink-muted">
                  Incidents logged: {evidenceDispute.evidence.incidents.length}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border-default bg-canvas p-3.5 space-y-2">
              <p className="font-medium text-ink flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                <span>Attempt Event &amp; Incident Timeline</span>
              </p>
              <div className="space-y-1 font-mono text-[11px] text-ink-muted">
                <p>Started: {new Date(evidenceDispute.evidence.startedAt).toLocaleString()}</p>
                {evidenceDispute.evidence.incidents.length === 0 ? (
                  <p>No offline or focus incidents recorded.</p>
                ) : (
                  evidenceDispute.evidence.incidents.map((inc) => (
                    <p key={inc.id}>
                      {new Date(inc.at).toLocaleTimeString()} · {inc.type}
                      {inc.detail ? ` (${inc.detail})` : ""}
                    </p>
                  ))
                )}
                {evidenceDispute.evidence.submittedAt && (
                  <p>
                    Submitted:{" "}
                    {new Date(evidenceDispute.evidence.submittedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {evidenceDispute.evidence.gradeHistory.length > 0 && (
              <div className="rounded-lg border border-border-default bg-surface p-3.5 space-y-1.5">
                <p className="font-medium text-ink flex items-center gap-1.5">
                  <FileWarning className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                  <span>Question Grade Ledger (Append-Only)</span>
                </p>
                {evidenceDispute.evidence.gradeHistory.map((g, i) => (
                  <p key={g.id} className="font-mono text-[11px] text-ink-muted">
                    {i === 0 ? "Latest: " : "Prior: "}
                    {g.score} marks{g.reason ? ` — ${g.reason}` : ""} (
                    {new Date(g.createdAt).toLocaleString()})
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function AttemptIncidentsBanner({
  incidents,
}: {
  incidents: Array<{ id: string; type: string; detail: string | null; at: string }>;
}) {
  if (incidents.length === 0) return null;
  return (
    <div className="rounded-lg border border-border-default bg-surface px-4 py-3 flex items-start gap-2.5 text-xs text-ink-muted">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-ink-muted" aria-hidden="true" />
      <div>
        <span className="font-medium text-ink">
          Session telemetry recorded {incidents.length} event(s):{" "}
        </span>
        <span className="font-mono">
          {incidents
            .slice(0, 4)
            .map((i) => `${i.type} @ ${new Date(i.at).toLocaleTimeString()}`)
            .join(" · ")}
          {incidents.length > 4 ? ` (+${incidents.length - 4} more)` : ""}
        </span>
      </div>
    </div>
  );
}
