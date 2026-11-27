"use client";

import * as React from "react";
import { CheckCircle2, Clock, History } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from "@/components/ui";
import type { ResultRow, WrittenGradingItem } from "@/lib/results";

interface GradingStateResponse {
  exam: {
    id: string;
    resultsPublished: boolean;
  };
  inProgressCount: number;
  pendingWrittenAttempts: number;
  writtenItems: WrittenGradingItem[];
  results: ResultRow[];
}

export function GradingTab({
  examId,
  items,
  onUpdated,
}: {
  examId: string;
  items: WrittenGradingItem[];
  onUpdated: (next: GradingStateResponse) => void;
}) {
  const toast = useToast();
  const [scores, setScores] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      map[item.attemptQuestionId] =
        item.latestScore !== null ? String(item.latestScore) : "";
    }
    return map;
  });
  const [reasons, setReasons] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      map[item.attemptQuestionId] = item.latestReason ?? "";
    }
    return map;
  });
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const pendingCount = items.filter((i) => i.latestScore === null).length;

  const handleSave = async (item: WrittenGradingItem) => {
    const rawScore = scores[item.attemptQuestionId] ?? "";
    const numericScore = Number(rawScore);

    if (
      rawScore.trim() === "" ||
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > item.maxMarks
    ) {
      toast.warning(
        "Invalid score",
        `Score must be between 0 and ${item.maxMarks}.`,
      );
      return;
    }

    setSavingId(item.attemptQuestionId);
    try {
      const res = await fetch(`/api/examiner/exams/${examId}/grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptQuestionId: item.attemptQuestionId,
          score: numericScore,
          reason: reasons[item.attemptQuestionId] ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Grade rejected", data.error ?? "Could not save grade");
        return;
      }

      onUpdated(data);
      toast.success(
        `Saved grade for ${item.candidateName}`,
        `Append-only grade #${item.gradeCount + 1} recorded.`,
      );
    } catch {
      toast.warning("Network error", "Could not save manual grade.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-default bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-ink">Written Answers:</span>
          <Badge variant={pendingCount === 0 ? "pine" : "terracotta"}>
            {pendingCount} pending · {items.length} total
          </Badge>
        </div>
        <span className="text-xs text-ink-muted">
          Every save appends a new Grade row; existing grades are never erased.
        </span>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No written answers to grade</CardTitle>
            <CardDescription>
              Either this exam has no written questions or no candidates have
              submitted yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const isPending = item.latestScore === null;
            const isSaving = savingId === item.attemptQuestionId;

            return (
              <Card key={item.attemptQuestionId}>
                <CardHeader className="pb-4 border-b border-border-default">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>{item.candidateName}</CardTitle>
                      <p className="mt-0.5 font-mono text-xs text-ink-muted">
                        {item.candidateEmail} · Q{item.position} · Max{" "}
                        {item.maxMarks} marks
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.gradeCount > 0 && (
                        <Badge
                          variant="outline"
                          icon={<History className="h-3 w-3" aria-hidden="true" />}
                        >
                          {item.gradeCount} revision
                          {item.gradeCount > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {isPending ? (
                        <Badge
                          variant="terracotta"
                          icon={<Clock className="h-3 w-3" aria-hidden="true" />}
                        >
                          Pending
                        </Badge>
                      ) : (
                        <Badge
                          variant="pine"
                          icon={
                            <CheckCircle2
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          }
                        >
                          {item.latestScore} / {item.maxMarks}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
                      Prompt
                    </p>
                    <p className="mt-1 text-sm text-ink">{item.questionText}</p>
                  </div>

                  <div className="rounded-lg border border-border-default bg-canvas p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
                      Candidate Answer
                    </p>
                    <p className="mt-1.5 text-sm text-ink whitespace-pre-wrap leading-relaxed">
                      {item.writtenText.trim() || "(No response submitted)"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                    <div className="sm:col-span-3">
                      <Input
                        label={`Score (0 – ${item.maxMarks})`}
                        type="number"
                        step="0.5"
                        min={0}
                        max={item.maxMarks}
                        value={scores[item.attemptQuestionId] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScores((prev) => ({
                            ...prev,
                            [item.attemptQuestionId]: val,
                          }));
                        }}
                        disabled={isSaving}
                      />
                    </div>
                    <div className="sm:col-span-7">
                      <Input
                        label="Feedback / Reason (optional)"
                        placeholder="Clear explanation of scoring..."
                        value={reasons[item.attemptQuestionId] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReasons((prev) => ({
                            ...prev,
                            [item.attemptQuestionId]: val,
                          }));
                        }}
                        disabled={isSaving}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        variant="primary"
                        className="w-full"
                        loading={isSaving}
                        loadingLabel="Saving..."
                        onClick={() => void handleSave(item)}
                      >
                        {isPending ? "Save" : "Re-grade"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
