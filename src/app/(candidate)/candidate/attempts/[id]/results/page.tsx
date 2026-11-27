import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
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
  requireAttemptOwner,
} from "@/lib/permissions";
import { getCandidateAttemptResult } from "@/lib/results";
import { getRoleHome } from "@/lib/session";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function CandidateAttemptResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE") {
    redirect(getRoleHome(user.role));
  }

  const { id } = await params;

  try {
    await requireAttemptOwner(id);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    redirect("/candidate");
  }

  const result = await getCandidateAttemptResult(id);

  return (
    <PageShell
      headerRight={<RoleHeaderActions name={user.name} role={user.role} />}
    >
      <div className="space-y-8">
        <div>
          <Link
            href="/candidate"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Scheduled Assessments</span>
          </Link>
          <h1 className="mt-2 font-serif text-3xl font-medium text-ink tracking-[-0.02em]">
            {result.examTitle}
          </h1>
        </div>

        {!result.published ? (
          <Card className="max-w-xl">
            <CardHeader>
              <Badge
                variant="neutral"
                icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                {result.status}
              </Badge>
              <CardTitle className="mt-4">Results not yet published</CardTitle>
              <CardDescription>
                Your submission is safely recorded. Scores and question-by-question
                breakdowns become visible once your examiner publishes results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.submittedAt && (
                <p className="font-mono text-xs text-ink-muted tabular-nums">
                  Submitted: {new Date(result.submittedAt).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
                    Published Result
                  </p>
                  <p className="mt-1 font-serif text-3xl font-medium text-ink tabular-nums">
                    {result.totalScore} / {result.totalMarks}{" "}
                    <span className="text-lg font-mono text-pine">
                      ({result.percentage}%)
                    </span>
                  </p>
                </div>
                <Badge
                  variant="pine"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  {result.status}
                </Badge>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {result.questions.map((q) => (
                <Card key={q.attemptQuestionId}>
                  <CardHeader className="pb-4 border-b border-border-default">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-semibold text-pine tabular-nums">
                          Q{q.position}
                        </span>
                        <Badge variant="outline">{q.type}</Badge>
                      </div>
                      <Badge
                        variant={
                          q.awardedScore !== null && q.awardedScore > 0
                            ? "pine"
                            : "neutral"
                        }
                      >
                        {q.awardedScore !== null
                          ? `${q.awardedScore} / ${q.marks} marks`
                          : `Pending / ${q.marks} marks`}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-5 space-y-4">
                    <p className="text-sm sm:text-[15px] text-ink leading-relaxed whitespace-pre-wrap">
                      {q.text}
                    </p>

                    {q.type === "WRITTEN" ? (
                      <div className="rounded-lg border border-border-default bg-canvas p-4 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
                          Your Answer
                        </p>
                        <p className="text-sm text-ink whitespace-pre-wrap">
                          {q.writtenText?.trim() || "(No response submitted)"}
                        </p>
                        {q.feedback && (
                          <p className="pt-2 border-t border-border-default text-xs text-pine">
                            Examiner note: {q.feedback}
                          </p>
                        )}
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
                                      opt.isCorrect
                                        ? "text-pine"
                                        : "text-terracotta",
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
                                {chosen && (
                                  <Badge variant="outline">Your answer</Badge>
                                )}
                                {opt.isCorrect && (
                                  <Badge variant="pine">
                                    {opt.acceptedByRuling
                                      ? "Accepted by ruling"
                                      : "Correct"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.gradeHistory.length > 1 && (
                      <div className="pt-3 border-t border-border-default space-y-1">
                        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                          <History className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Grade History</span>
                        </p>
                        {q.gradeHistory.map((g, idx) => (
                          <p
                            key={g.id}
                            className="font-mono text-xs text-ink-muted"
                          >
                            {idx === 0 ? "Current: " : "Previous: "}
                            {g.score} marks{g.reason ? ` (${g.reason})` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
