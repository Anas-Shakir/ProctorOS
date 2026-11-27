"use client";

import * as React from "react";
import {
  CheckCircle2,
  Gavel,
  Scale,
  ShieldAlert,
  ShieldCheck,
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
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  useToast,
} from "@/components/ui";
import type { AuditLogEntryView, AuditVerifyResult } from "@/lib/audit";
import type {
  ExamRulingItem,
  ExamRulingQuestionTarget,
  ExaminerDisputeItem,
  RegradeDiffRow,
} from "@/lib/disputes";

const STATUS_BADGE: Record<
  ExaminerDisputeItem["status"],
  { label: string; variant: "outline" | "neutral" | "pine" | "terracotta" }
> = {
  OPEN: { label: "Open", variant: "outline" },
  UNDER_REVIEW: { label: "Under Review", variant: "neutral" },
  UPHELD: { label: "Upheld", variant: "pine" },
  REJECTED: { label: "Rejected", variant: "terracotta" },
};

const CATEGORY_LABEL: Record<ExaminerDisputeItem["category"], string> = {
  GRADING_ERROR: "Grading Error",
  AMBIGUOUS: "Ambiguous Question",
  TECHNICAL: "Technical Incident",
};

export function DisputesTab({
  examId,
  initialDisputes,
  initialRulings,
  initialQuestionTargets,
  initialAuditEntries,
  initialAuditHeadHash,
  onGradesChanged,
}: {
  examId: string;
  initialDisputes: ExaminerDisputeItem[];
  initialRulings: ExamRulingItem[];
  initialQuestionTargets: ExamRulingQuestionTarget[];
  initialAuditEntries: AuditLogEntryView[];
  initialAuditHeadHash: string;
  onGradesChanged?: () => void;
}) {
  const toast = useToast();

  const [disputes, setDisputes] =
    React.useState<ExaminerDisputeItem[]>(initialDisputes);
  const [rulings, setRulings] = React.useState<ExamRulingItem[]>(initialRulings);
  const [questionTargets, setQuestionTargets] = React.useState<
    ExamRulingQuestionTarget[]
  >(initialQuestionTargets);

  const [auditEntries, setAuditEntries] =
    React.useState<AuditLogEntryView[]>(initialAuditEntries);
  const [headHash, setHeadHash] = React.useState(initialAuditHeadHash);
  const [verifyingAudit, setVerifyingAudit] = React.useState(false);
  const [verifyResult, setVerifyResult] =
    React.useState<AuditVerifyResult | null>(null);
  const [showAuditLog, setShowAuditLog] = React.useState(false);

  // Single dispute resolution modal
  const [activeDispute, setActiveDispute] =
    React.useState<ExaminerDisputeItem | null>(null);
  const [decision, setDecision] = React.useState<
    "UNDER_REVIEW" | "REJECT" | "UPHOLD"
  >("REJECT");
  const [resolutionNote, setResolutionNote] = React.useState("");
  const [upholdScore, setUpholdScore] = React.useState("");
  const [resolvingDispute, setResolvingDispute] = React.useState(false);

  // Question-level ruling modal + diff output
  const [rulingModalOpen, setRulingModalOpen] = React.useState(false);
  const [rulingSourceId, setRulingSourceId] = React.useState(
    initialQuestionTargets[0]?.sourceQuestionId ?? "",
  );
  const [rulingType, setRulingType] = React.useState<
    "ACCEPT_ALTERNATE" | "VOID_QUESTION"
  >("ACCEPT_ALTERNATE");
  const [acceptedOptionIds, setAcceptedOptionIds] = React.useState<string[]>(
    [],
  );
  const [rulingReason, setRulingReason] = React.useState("");
  const [rulingDisputeId, setRulingDisputeId] = React.useState<
    string | undefined
  >(undefined);
  const [applyingRuling, setApplyingRuling] = React.useState(false);
  const [lastDiff, setLastDiff] = React.useState<{
    rulingId: string;
    regradedCount: number;
    changedCount: number;
    diffs: RegradeDiffRow[];
  } | null>(null);

  const selectedTarget = React.useMemo(
    () =>
      questionTargets.find((q) => q.sourceQuestionId === rulingSourceId) ?? null,
    [questionTargets, rulingSourceId],
  );

  const refreshAuditTrail = async () => {
    const res = await fetch("/api/audit?limit=30", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setAuditEntries(data.entries);
      setHeadHash(data.headHash);
    }
  };

  const handleVerifyAudit = async () => {
    setVerifyingAudit(true);
    try {
      const res = await fetch("/api/audit/verify", { method: "POST" });
      const data = (await res.json()) as AuditVerifyResult;
      if (!res.ok) {
        toast.warning("Verification failed", "Could not check audit chain.");
        return;
      }
      setVerifyResult(data);
      if (data.ok) {
        toast.success(
          "Audit chain verified",
          `${data.totalChecked} immutable entries verified cleanly.`,
        );
      } else {
        toast.warning(
          "Chain integrity failure",
          data.brokenRow?.reason ?? "Mismatch detected.",
        );
      }
    } catch {
      toast.warning("Network error", "Could not run integrity verification.");
    } finally {
      setVerifyingAudit(false);
    }
  };

  const openResolveModal = (
    dispute: ExaminerDisputeItem,
    initialDecision: "UNDER_REVIEW" | "REJECT" | "UPHOLD",
  ) => {
    setActiveDispute(dispute);
    setDecision(initialDecision);
    setResolutionNote(dispute.resolution ?? "");
    setUpholdScore(
      dispute.evidence.awardedScore !== null
        ? String(dispute.evidence.awardedScore)
        : String(dispute.evidence.question.marks),
    );
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDispute) return;

    setResolvingDispute(true);
    try {
      const res = await fetch(
        `/api/examiner/exams/${examId}/disputes/${activeDispute.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            resolution: resolutionNote.trim() || undefined,
            ...(decision === "UPHOLD" ? { newScore: Number(upholdScore) } : {}),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Update refused", data.error ?? "Could not update dispute");
        return;
      }
      setDisputes(data.disputes);
      setRulings(data.rulings);
      setQuestionTargets(data.questionTargets);
      setActiveDispute(null);
      await refreshAuditTrail();
      onGradesChanged?.();
      toast.success("Dispute updated", `Status set to ${decision}.`);
    } catch {
      toast.warning("Network error", "Could not resolve dispute.");
    } finally {
      setResolvingDispute(false);
    }
  };

  const openRulingModal = (sourceQuestionId?: string, disputeId?: string) => {
    const targetId =
      sourceQuestionId ?? questionTargets[0]?.sourceQuestionId ?? "";
    const target = questionTargets.find((q) => q.sourceQuestionId === targetId);
    setRulingSourceId(targetId);
    setRulingType(
      target && target.type === "WRITTEN"
        ? "VOID_QUESTION"
        : "ACCEPT_ALTERNATE",
    );
    setAcceptedOptionIds([]);
    setRulingReason("");
    setRulingDisputeId(disputeId);
    setRulingModalOpen(true);
  };

  const handleApplyRuling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulingSourceId) return;

    setApplyingRuling(true);
    try {
      const res = await fetch(`/api/examiner/exams/${examId}/rulings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceQuestionId: rulingSourceId,
          type: rulingType,
          acceptedOptionIds:
            rulingType === "ACCEPT_ALTERNATE" ? acceptedOptionIds : [],
          reason: rulingReason.trim(),
          disputeId: rulingDisputeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Ruling rejected", data.error ?? "Could not apply ruling");
        return;
      }

      setDisputes(data.state.disputes);
      setRulings(data.state.rulings);
      setQuestionTargets(data.state.questionTargets);
      setLastDiff({
        rulingId: data.rulingId,
        regradedCount: data.regradedCount,
        changedCount: data.changedCount,
        diffs: data.diffs,
      });
      setRulingModalOpen(false);
      await refreshAuditTrail();
      onGradesChanged?.();
      toast.success(
        "Question ruling applied",
        `${data.regradedCount} attempt(s) recomputed (${data.changedCount} score change(s)).`,
      );
    } catch {
      toast.warning("Network error", "Could not apply question ruling.");
    } finally {
      setApplyingRuling(false);
    }
  };

  const openCount = disputes.filter(
    (d) => d.status === "OPEN" || d.status === "UNDER_REVIEW",
  ).length;

  return (
    <div className="space-y-8">
      {/* Audit Chain Integrity Bar */}
      <Card>
        <CardContent className="pt-5 pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Scale className="h-4 w-4 text-pine" aria-hidden="true" />
              <h2 className="font-serif text-lg font-medium text-ink">
                Tamper-Evident Audit Chain
              </h2>
              {verifyResult ? (
                verifyResult.ok ? (
                  <Badge
                    variant="pine"
                    icon={<ShieldCheck className="h-3 w-3" aria-hidden="true" />}
                  >
                    Verified ({verifyResult.totalChecked} entries)
                  </Badge>
                ) : (
                  <Badge
                    variant="terracotta"
                    icon={<ShieldAlert className="h-3 w-3" aria-hidden="true" />}
                  >
                    Broken at Row #{verifyResult.brokenRow?.id}
                  </Badge>
                )
              ) : (
                <Badge variant="outline">
                  Head: {headHash.slice(0, 12)}...
                </Badge>
              )}
            </div>
            <p className="text-xs text-ink-muted">
              Every score update, result publication, dispute decision, and question ruling is SHA-256 hash-chained with transaction advisory locking.
            </p>
            {verifyResult && !verifyResult.ok && verifyResult.brokenRow && (
              <p className="text-xs font-medium text-terracotta pt-1">
                Row #{verifyResult.brokenRow.id} ({verifyResult.brokenRow.action} on{" "}
                {verifyResult.brokenRow.entity}): {verifyResult.brokenRow.reason}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAuditLog((v) => !v)}
            >
              {showAuditLog ? "Hide Audit Ledger" : `Audit Ledger (${auditEntries.length})`}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={verifyingAudit}
              loadingLabel="Verifying..."
              onClick={() => void handleVerifyAudit()}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Verify Integrity</span>
            </Button>
          </div>
        </CardContent>

        {showAuditLog && (
          <div className="border-t border-border-default px-6 pb-5 pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Hash Prefix</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditEntries.length === 0 ? (
                  <TableEmpty colSpan={6} title="No audit entries recorded yet." />
                ) : (
                  auditEntries.map((entry) => {
                    const isBroken = verifyResult?.brokenRow?.id === entry.id;
                    return (
                      <TableRow
                        key={entry.id}
                        className={isBroken ? "bg-terracotta-tint/60" : undefined}
                      >
                        <TableCell className="font-mono text-xs tabular-nums">
                          #{entry.id}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {entry.action}
                        </TableCell>
                        <TableCell className="text-xs text-ink-muted">
                          {entry.entity} ({entry.entityId.slice(0, 8)}...)
                        </TableCell>
                        <TableCell className="text-xs">
                          {entry.actor?.name ?? "System"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-ink-muted">
                          {entry.hash.slice(0, 12)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs text-ink-muted tabular-nums">
                          {new Date(entry.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Latest Before/After Regrade Diff Table */}
      {lastDiff && (
        <Card>
          <CardHeader className="pb-4 border-b border-border-default">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-pine" aria-hidden="true" />
                <CardTitle>Question Ruling Regrade Diff</CardTitle>
              </div>
              <Badge variant="pine">
                {lastDiff.changedCount} updated / {lastDiff.regradedCount} affected
              </Badge>
            </div>
            <CardDescription>
              Old grades remain preserved in the ledger. Candidate totals and verification tokens were updated atomically.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Old Q Score</TableHead>
                  <TableHead>New Q Score</TableHead>
                  <TableHead>Old Total</TableHead>
                  <TableHead>New Total</TableHead>
                  <TableHead>Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastDiff.diffs.length === 0 ? (
                  <TableEmpty
                    colSpan={6}
                    title="No submitted attempts contained this question yet."
                  />
                ) : (
                  lastDiff.diffs.map((row) => (
                    <TableRow key={row.attemptId}>
                      <TableCell>
                        <p className="font-medium text-ink">{row.candidateName}</p>
                        <p className="text-xs text-ink-muted">{row.candidateEmail}</p>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {row.oldQuestionScore}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {row.newQuestionScore}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {row.oldTotalScore}
                      </TableCell>
                      <TableCell className="font-mono font-medium tabular-nums">
                        {row.newTotalScore}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.delta > 0
                              ? "pine"
                              : row.delta < 0
                                ? "terracotta"
                                : "neutral"
                          }
                          className="font-mono tabular-nums"
                        >
                          {row.delta > 0 ? `+${row.delta}` : row.delta}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dispute Queue Header + Issue Ruling CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-medium text-ink">
            Candidate Disputes &amp; Question Rulings
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            {openCount} pending dispute(s) · {rulings.length} question ruling(s) issued on this exam.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={questionTargets.length === 0}
          onClick={() => openRulingModal()}
        >
          <Gavel className="h-4 w-4" aria-hidden="true" />
          <span>Issue Question Ruling</span>
        </Button>
      </div>

      {/* Active Question Rulings Summary */}
      {rulings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Question Rulings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {rulings.map((r) => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border-default bg-canvas px-4 py-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="pine">
                      {r.type === "VOID_QUESTION"
                        ? "Void Question (Full Marks)"
                        : "Accept Alternate Option"}
                    </Badge>
                    <span className="font-medium text-ink line-clamp-1">
                      {r.questionText}
                    </span>
                  </div>
                  <p className="text-ink-muted">Reason: {r.reason}</p>
                </div>
                <span className="font-mono text-[11px] text-ink-muted shrink-0">
                  {r.createdByName} · {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Candidate Disputes List */}
      {disputes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No candidate disputes filed</CardTitle>
            <CardDescription>
              Once results are published, candidates can challenge grading errors, ambiguous questions, or technical incidents from their result view.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => {
            const badge = STATUS_BADGE[d.status];
            return (
              <Card key={d.id}>
                <CardHeader className="pb-4 border-b border-border-default">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        <Badge variant="outline">
                          Q{d.questionPosition} · {CATEGORY_LABEL[d.category]}
                        </Badge>
                        <span className="font-mono text-xs text-ink-muted tabular-nums">
                          {d.evidence.awardedScore ?? "Pending"} /{" "}
                          {d.evidence.question.marks} marks
                        </span>
                      </div>
                      <p className="text-sm font-medium text-ink">
                        {d.candidate.name}{" "}
                        <span className="font-normal text-ink-muted">
                          ({d.candidate.email})
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {d.status === "OPEN" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openResolveModal(d, "UNDER_REVIEW")}
                        >
                          Mark Under Review
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openResolveModal(d, "REJECT")}
                      >
                        <XCircle className="h-3.5 w-3.5 text-terracotta" aria-hidden="true" />
                        <span>Reject</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openResolveModal(d, "UPHOLD")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-pine" aria-hidden="true" />
                        <span>Uphold &amp; Regrade</span>
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openRulingModal(d.sourceQuestionId, d.id)}
                      >
                        <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Question Ruling</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <div className="rounded-lg border border-border-default bg-canvas px-4 py-3 text-sm text-ink">
                    {d.message}
                  </div>

                  {d.resolution && (
                    <div className="rounded-lg border border-pine/25 bg-pine-tint/60 px-4 py-2.5 text-xs text-ink">
                      <span className="font-medium">Resolution note: </span>
                      {d.resolution}
                      {d.resolverName ? ` — ${d.resolverName}` : ""}
                    </div>
                  )}

                  {/* Evidence Pack Summary */}
                  <details className="rounded-lg border border-border-default bg-surface px-4 py-3 text-xs">
                    <summary className="cursor-pointer font-medium text-ink select-none">
                      Evidence Pack (Snapshot, Answer, {d.evidence.incidents.length} Incident(s), {d.evidence.gradeHistory.length} Grade Entry/Entries)
                    </summary>
                    <div className="mt-3 space-y-3 pt-3 border-t border-border-default">
                      <div>
                        <p className="font-medium text-ink mb-1">Question Prompt</p>
                        <p className="text-ink-muted whitespace-pre-wrap">
                          {d.evidence.question.text}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="font-medium text-ink mb-1">Candidate Response</p>
                          {d.evidence.question.type === "WRITTEN" ? (
                            <p className="text-ink-muted whitespace-pre-wrap">
                              {d.evidence.answer.writtenText || "(Blank)"}
                            </p>
                          ) : (
                            <ul className="space-y-1">
                              {d.evidence.question.options.map((opt) => {
                                const picked =
                                  d.evidence.answer.selectedOptionIds.includes(
                                    opt.id,
                                  );
                                return (
                                  <li
                                    key={opt.id}
                                    className="flex items-center gap-2 text-ink-muted"
                                  >
                                    <span className="font-mono text-[11px]">
                                      {picked ? "[X]" : "[ ]"}
                                    </span>
                                    <span
                                      className={
                                        opt.isCorrect
                                          ? "font-medium text-pine"
                                          : undefined
                                      }
                                    >
                                      {opt.text}
                                      {opt.isCorrect ? " (Key)" : ""}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-ink mb-1">
                            Grade History &amp; Events
                          </p>
                          <div className="space-y-1 font-mono text-[11px] text-ink-muted">
                            {d.evidence.gradeHistory.map((g) => (
                              <p key={g.id}>
                                {g.score} marks · {g.reason || "Auto-graded"}
                              </p>
                            ))}
                            {d.evidence.incidents.map((inc) => (
                              <p key={inc.id}>
                                {inc.type} @{" "}
                                {new Date(inc.at).toLocaleTimeString()}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resolve Single Dispute Modal */}
      <Modal
        open={Boolean(activeDispute)}
        onClose={() => setActiveDispute(null)}
        title={
          decision === "UPHOLD"
            ? "Uphold Dispute & Regrade Candidate"
            : decision === "REJECT"
              ? "Reject Dispute"
              : "Mark Under Review"
        }
        description={
          activeDispute
            ? `${activeDispute.candidate.name} · Q${activeDispute.questionPosition} (max ${activeDispute.evidence.question.marks} marks)`
            : undefined
        }
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setActiveDispute(null)}
              disabled={resolvingDispute}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="resolve-dispute-form"
              variant={decision === "REJECT" ? "danger" : "primary"}
              loading={resolvingDispute}
              loadingLabel="Saving..."
            >
              Confirm Decision
            </Button>
          </>
        }
      >
        {activeDispute && (
          <form
            id="resolve-dispute-form"
            onSubmit={handleResolveSubmit}
            className="space-y-4"
          >
            {decision === "UPHOLD" && (
              <Input
                label={`Updated Question Score (0 – ${activeDispute.evidence.question.marks})`}
                type="number"
                step="0.25"
                min="0"
                max={activeDispute.evidence.question.marks}
                value={upholdScore}
                onChange={(e) => setUpholdScore(e.target.value)}
                disabled={resolvingDispute}
              />
            )}

            <Textarea
              label={
                decision === "UNDER_REVIEW"
                  ? "Optional Note"
                  : "Resolution Reason (visible to candidate)"
              }
              rows={3}
              placeholder="Explain the decision clearly..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              disabled={resolvingDispute}
            />
          </form>
        )}
      </Modal>

      {/* Question-Level Ruling Modal */}
      <Modal
        open={rulingModalOpen}
        onClose={() => setRulingModalOpen(false)}
        title="Issue Question-Level Ruling"
        description="Recomputes every affected candidate's score from immutable snapshots plus this ruling inside one atomic transaction."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRulingModalOpen(false)}
              disabled={applyingRuling}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="question-ruling-form"
              variant="primary"
              loading={applyingRuling}
              loadingLabel="Regrading..."
            >
              Apply Ruling &amp; Regrade All
            </Button>
          </>
        }
      >
        <form
          id="question-ruling-form"
          onSubmit={handleApplyRuling}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="ruling-question-select"
              className="block text-xs font-medium text-ink mb-1.5"
            >
              Target Question
            </label>
            <select
              id="ruling-question-select"
              value={rulingSourceId}
              onChange={(e) => {
                setRulingSourceId(e.target.value);
                setAcceptedOptionIds([]);
              }}
              className="w-full h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pine/40"
            >
              {questionTargets.map((q) => (
                <option key={q.sourceQuestionId} value={q.sourceQuestionId}>
                  Q{q.positionHint} ({q.type}, {q.marks}m, {q.affectedAttemptCount}{" "}
                  attempts) — {q.text.slice(0, 70)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-2.5 rounded-lg border border-border-default bg-canvas px-3.5 py-3 cursor-pointer">
              <input
                type="radio"
                name="rulingType"
                value="ACCEPT_ALTERNATE"
                checked={rulingType === "ACCEPT_ALTERNATE"}
                disabled={selectedTarget?.type === "WRITTEN"}
                onChange={() => setRulingType("ACCEPT_ALTERNATE")}
                className="mt-0.5 accent-pine"
              />
              <div>
                <p className="text-xs font-medium text-ink">
                  Accept Alternate Option(s)
                </p>
                <p className="text-[11px] text-ink-muted">
                  Grant credit for additional valid option(s) without altering frozen snapshots.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 rounded-lg border border-border-default bg-canvas px-3.5 py-3 cursor-pointer">
              <input
                type="radio"
                name="rulingType"
                value="VOID_QUESTION"
                checked={rulingType === "VOID_QUESTION"}
                onChange={() => setRulingType("VOID_QUESTION")}
                className="mt-0.5 accent-pine"
              />
              <div>
                <p className="text-xs font-medium text-ink">
                  Void Question (Full Marks)
                </p>
                <p className="text-[11px] text-ink-muted">
                  Award full marks ({selectedTarget?.marks ?? 0}) to every submitted attempt.
                </p>
              </div>
            </label>
          </div>

          {rulingType === "ACCEPT_ALTERNATE" && selectedTarget && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink">
                Select Alternate Option(s) to Accept
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedTarget.options.map((opt) => {
                  const checked = acceptedOptionIds.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface px-3.5 py-2.5 text-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={opt.isCorrect}
                          onChange={() =>
                            setAcceptedOptionIds((prev) =>
                              checked
                                ? prev.filter((id) => id !== opt.id)
                                : [...prev, opt.id],
                            )
                          }
                          className="accent-pine h-4 w-4 rounded"
                        />
                        <span>{opt.text}</span>
                      </span>
                      {opt.isCorrect && (
                        <Badge variant="pine">Original Key</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <Textarea
            label="Ruling Reason (logged to audit chain & candidate grade history)"
            rows={3}
            placeholder="e.g., Option B is technically valid under PostgreSQL SSI semantics..."
            value={rulingReason}
            onChange={(e) => setRulingReason(e.target.value)}
            disabled={applyingRuling}
          />
        </form>
      </Modal>
    </div>
  );
}
