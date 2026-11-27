import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  History,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageShell,
} from "@/components/ui";
import { RoleHeaderActions } from "@/components/auth/role-header-actions";
import {
  getActiveSessionUser,
  HttpError,
  requireExamOwner,
} from "@/lib/permissions";
import { getAttemptReview } from "@/lib/results";
import { getRoleHome } from "@/lib/session";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function ExaminerAttemptReviewPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "EXAMINER" && user.role !== "ADMIN") {
    redirect(getRoleHome(user.role));
  }

  const { id: examId, attemptId } = await params;

  try {
    await requireExamOwner(examId);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    redirect("/examiner");
  }

  let review;
  try {
    review = await getAttemptReview(examId, attemptId);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }

  return (
    <PageShell
      headerRight={<RoleHeaderActions name={user.name} role={user.role} />}
    >
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <Link
              href={`/examiner/exams/${examId}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back to Exam Workspace</span>
            </Link>
            <h1 className="mt-2 font-serif text-3xl font-medium text-ink tracking-[-0.02em]">
              Attempt Review — {review.candidate.name}
            </h1>
            <p className="mt-1.5 font-mono text-xs text-ink-muted">
              {review.exam.title} · {review.candidate.email}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={review.attempt.status === "GRADED" ? "pine" : "outline"}>
              {review.attempt.status}
            </Badge>
            <Badge variant="pine">
              Score: {review.attempt.totalScore} / {review.exam.totalMarks}
            </Badge>
          </div>
        </div>

        {/* Frozen Paper, Candidate Answers & Append-Only Grade History */}
        <div className="space-y-4">
          {review.questions.map((q) => (
            <Card key={q.attemptQuestionId}>
              <CardHeader className="pb-4 border-b border-border-default">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold text-pine tabular-nums">
                      Q{q.position}
                    </span>
                    <Badge variant="outline">{q.type}</Badge>
                    <span className="font-mono text-xs text-ink-muted tabular-nums">
                      {q.marks} marks
                    </span>
                  </div>
                  <Badge variant={q.latestScore !== null ? "pine" : "terracotta"}>
                    {q.latestScore !== null
                      ? `Awarded: ${q.latestScore} / ${q.marks}`
                      : "Pending Grade"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-4">
                <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {q.text}
                </p>

                {q.type === "WRITTEN" ? (
                  <div className="rounded-lg border border-border-default bg-canvas p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
                      Candidate Written Answer
                    </p>
                    <p className="mt-1.5 text-sm text-ink whitespace-pre-wrap">
                      {q.writtenText?.trim() || "(No response submitted)"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const chosen = q.selectedOptionIds.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            "rounded-lg border px-3.5 py-2.5 text-sm flex items-center justify-between gap-3",
                            opt.isCorrect
                              ? "border-pine/30 bg-pine-tint/70"
                              : chosen
                                ? "border-terracotta/30 bg-terracotta-tint/70"
                                : "border-border-default bg-surface",
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            {chosen ? (
                              <CheckCircle2
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  opt.isCorrect ? "text-pine" : "text-terracotta",
                                )}
                                aria-hidden="true"
                              />
                            ) : opt.isCorrect ? (
                              <Check
                                className="h-4 w-4 shrink-0 text-pine"
                                aria-hidden="true"
                              />
                            ) : (
                              <span className="h-4 w-4 shrink-0" />
                            )}
                            <span>{opt.text}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono">
                            {chosen && <Badge variant="outline">Chosen</Badge>}
                            {opt.isCorrect && <Badge variant="pine">Correct</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.gradeHistory.length > 0 && (
                  <div className="pt-3 border-t border-border-default space-y-1.5">
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                      <History className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Grade History (append-only, latest wins)</span>
                    </p>
                    {q.gradeHistory.map((g, idx) => (
                      <div
                        key={g.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-ink-muted"
                      >
                        <span>
                          {idx === 0 ? "Current: " : "Prior: "}
                          <strong className="text-ink">{g.score}</strong>
                          {g.reason ? ` — ${g.reason}` : ""}
                        </span>
                        <span>{new Date(g.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recorded Events / Incident Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Recorded Events Timeline</CardTitle>
            <CardDescription>
              These are automated indicators and are not evidence of misconduct.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {review.incidents.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No automated session events were recorded during this attempt.
              </p>
            ) : (
              review.incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-canvas px-4 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertCircle
                      className="h-3.5 w-3.5 text-ink-muted shrink-0"
                      aria-hidden="true"
                    />
                    <Badge variant="outline">{inc.type}</Badge>
                    <span className="text-ink">{inc.detail ?? "Recorded"}</span>
                  </div>
                  <span className="font-mono text-ink-muted tabular-nums">
                    {new Date(inc.at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
