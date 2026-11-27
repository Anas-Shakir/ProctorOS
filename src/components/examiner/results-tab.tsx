"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Send,
} from "lucide-react";
import {
  Badge,
  Button,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from "@/components/ui";
import type { ResultRow } from "@/lib/results";

export function ResultsTab({
  examId,
  examStatus,
  totalMarks,
  resultsPublished,
  inProgressCount,
  pendingWrittenAttempts,
  results,
  onPublished,
}: {
  examId: string;
  examStatus: "DRAFT" | "PUBLISHED";
  totalMarks: number;
  resultsPublished: boolean;
  inProgressCount: number;
  pendingWrittenAttempts: number;
  results: ResultRow[];
  onPublished: () => void;
}) {
  const toast = useToast();
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [overrideConfirm, setOverrideConfirm] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

  const handlePublishResults = async () => {
    setPublishing(true);
    try {
      const res = await fetch(
        `/api/examiner/exams/${examId}/publish-results`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ override: overrideConfirm }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.warning(
          "Publication blocked",
          data.error ?? "Cannot publish results yet",
        );
        return;
      }

      onPublished();
      setPublishOpen(false);
      toast.success(
        "Results published",
        "Candidates can now view their scores and question breakdowns.",
      );
    } catch {
      toast.warning("Network error", "Could not publish results.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border-default bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-ink">
            Result Visibility:
          </span>
          {resultsPublished ? (
            <Badge
              variant="pine"
              icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
            >
              Published to Candidates
            </Badge>
          ) : (
            <Badge
              variant="neutral"
              icon={<Clock className="h-3 w-3" aria-hidden="true" />}
            >
              Hidden (Unpublished)
            </Badge>
          )}
          {pendingWrittenAttempts > 0 && (
            <Badge variant="terracotta">
              {pendingWrittenAttempts} pending manual grade
            </Badge>
          )}
        </div>

        {!resultsPublished && examStatus === "PUBLISHED" && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setOverrideConfirm(false);
              setPublishOpen(true);
            }}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Publish Results</span>
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Objective</TableHead>
            <TableHead>Written</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Review</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.length === 0 ? (
            <TableEmpty
              colSpan={6}
              title="No finalized attempts yet"
              description="Submitted and auto-submitted candidate attempts appear here."
            />
          ) : (
            results.map((row) => (
              <TableRow key={row.attemptId}>
                <TableCell>
                  <p className="font-medium text-ink">{row.candidateName}</p>
                  <p className="font-mono text-xs text-ink-muted">
                    {row.candidateEmail}
                  </p>
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {row.objectiveScore}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {row.pendingWrittenCount > 0 ? (
                    <span className="text-terracotta">
                      {row.writtenScore} ({row.pendingWrittenCount} pending)
                    </span>
                  ) : (
                    row.writtenScore
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm font-semibold tabular-nums">
                  {row.totalScore} / {totalMarks}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.status === "GRADED" ? "pine" : "terracotta"
                    }
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/examiner/exams/${examId}/attempts/${row.attemptId}`}
                    className="pressable focus-ring inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border-default bg-surface text-xs font-medium text-ink hover:border-border-strong"
                  >
                    <span>Review</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Modal
        open={publishOpen}
        onClose={() => !publishing && setPublishOpen(false)}
        title="Publish Exam Results"
        description="Once published, enrolled candidates can view their scores, feedback, and correct answers."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={publishing}
              onClick={() => setPublishOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                publishing || (pendingWrittenAttempts > 0 && !overrideConfirm)
              }
              loading={publishing}
              loadingLabel="Publishing..."
              onClick={() => void handlePublishResults()}
            >
              Confirm Publish
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-canvas p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Finalized attempts</span>
              <span className="font-mono font-medium tabular-nums">
                {results.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">
                Pending manual written grades
              </span>
              <span
                className={
                  pendingWrittenAttempts > 0
                    ? "font-mono font-medium text-terracotta tabular-nums"
                    : "font-mono font-medium text-pine tabular-nums"
                }
              >
                {pendingWrittenAttempts}
              </span>
            </div>
            {inProgressCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Still in progress</span>
                <span className="font-mono font-medium text-terracotta tabular-nums">
                  {inProgressCount}
                </span>
              </div>
            )}
          </div>

          {pendingWrittenAttempts > 0 && (
            <div className="rounded-lg border border-terracotta/30 bg-terracotta-tint p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-terracotta">
                <AlertTriangle
                  className="h-4 w-4 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  {pendingWrittenAttempts} attempt(s) still have ungraded
                  written answers. Complete manual grading first or override
                  below.
                </span>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideConfirm}
                  onChange={(e) => setOverrideConfirm(e.target.checked)}
                  className="accent-terracotta h-4 w-4 rounded"
                />
                <span>Publish anyway with incomplete written grades</span>
              </label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
