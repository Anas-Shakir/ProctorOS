import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { finalizeExpired } from "@/lib/attempts";
import {
  parseSelectedOptionIds,
  parseSnapshotOptions,
} from "@/lib/grading";
import { HttpError } from "@/lib/permissions";

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Shared filter excluding sandbox attempts from every examiner query,
 * monitoring table, results table, analytics, and report export.
 */
export function realAttemptsWhere(
  extra?: Prisma.AttemptWhereInput,
): Prisma.AttemptWhereInput {
  return {
    isSandbox: false,
    ...(extra ?? {}),
  };
}

export interface WrittenGradingItem {
  attemptId: string;
  attemptQuestionId: string;
  position: number;
  candidateName: string;
  candidateEmail: string;
  questionText: string;
  writtenText: string;
  maxMarks: number;
  latestScore: number | null;
  latestReason: string | null;
  gradeCount: number;
  gradeHistory: Array<{
    id: string;
    score: number;
    reason: string | null;
    createdAt: string;
  }>;
}

export interface ResultRow {
  attemptId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  status: string;
  objectiveScore: number;
  writtenScore: number;
  totalScore: number;
  pendingWrittenCount: number;
  submittedAt: string | null;
}

export async function getExaminerGradingAndResults(examId: string) {
  await finalizeExpired(examId);

  const [exam, attempts, inProgressCount] = await Promise.all([
    db.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        title: true,
        totalMarks: true,
        status: true,
        resultsPublished: true,
      },
    }),
    db.attempt.findMany({
      where: realAttemptsWhere({
        examId,
        status: { not: "IN_PROGRESS" },
      }),
      include: {
        candidate: {
          select: { id: true, name: true, email: true },
        },
        questions: {
          orderBy: { position: "asc" },
          include: {
            answer: true,
            grades: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      orderBy: [{ candidate: { name: "asc" } }],
    }),
    db.attempt.count({
      where: realAttemptsWhere({
        examId,
        status: "IN_PROGRESS",
      }),
    }),
  ]);

  if (!exam) {
    throw new HttpError(404, "Exam not found");
  }

  const writtenItems: WrittenGradingItem[] = [];
  const results: ResultRow[] = [];

  for (const attempt of attempts) {
    let objectiveScore = 0;
    let writtenScore = 0;
    let pendingWrittenCount = 0;

    for (const aq of attempt.questions) {
      const latest = aq.grades[0] ?? null;

      if (aq.typeSnapshot === "WRITTEN") {
        if (latest) {
          writtenScore += latest.score;
        } else {
          pendingWrittenCount += 1;
        }

        writtenItems.push({
          attemptId: attempt.id,
          attemptQuestionId: aq.id,
          position: aq.position,
          candidateName: attempt.candidate.name,
          candidateEmail: attempt.candidate.email,
          questionText: aq.textSnapshot,
          writtenText: aq.answer?.writtenText ?? "",
          maxMarks: aq.marksSnapshot,
          latestScore: latest ? latest.score : null,
          latestReason: latest?.reason ?? null,
          gradeCount: aq.grades.length,
          gradeHistory: aq.grades.map((g) => ({
            id: g.id,
            score: g.score,
            reason: g.reason,
            createdAt: g.createdAt.toISOString(),
          })),
        });
      } else if (latest) {
        objectiveScore += latest.score;
      }
    }

    const roundedObjective = roundScore(objectiveScore);
    const roundedWritten = roundScore(writtenScore);
    const totalScore = roundScore(roundedObjective + roundedWritten);

    results.push({
      attemptId: attempt.id,
      candidateId: attempt.candidate.id,
      candidateName: attempt.candidate.name,
      candidateEmail: attempt.candidate.email,
      status: attempt.status,
      objectiveScore: roundedObjective,
      writtenScore: roundedWritten,
      totalScore,
      pendingWrittenCount,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
    });
  }

  const pendingWrittenAttempts = results.filter(
    (r) => r.pendingWrittenCount > 0,
  ).length;

  return {
    exam,
    inProgressCount,
    pendingWrittenAttempts,
    writtenItems,
    results,
  };
}

/**
 * Append a new manual Grade row (never editing/deleting old rows) and
 * recompute the attempt's totalScore from the latest grade per question.
 */
export async function saveManualGrade(params: {
  examId: string;
  examinerId: string;
  attemptQuestionId: string;
  score: number;
  reason?: string;
}) {
  const aq = await db.attemptQuestion.findUnique({
    where: { id: params.attemptQuestionId },
    include: {
      attempt: {
        select: {
          id: true,
          examId: true,
          isSandbox: true,
          status: true,
        },
      },
    },
  });

  if (!aq || aq.attempt.examId !== params.examId || aq.attempt.isSandbox) {
    throw new HttpError(404, "Attempt question not found for this exam");
  }

  if (aq.attempt.status === "IN_PROGRESS") {
    throw new HttpError(409, "Cannot grade an attempt while it is in progress");
  }

  if (params.score < 0 || params.score > aq.marksSnapshot) {
    throw new HttpError(
      400,
      `Score must be between 0 and ${aq.marksSnapshot}`,
    );
  }

  const roundedScore = roundScore(params.score);

  await db.$transaction(async (tx) => {
    await tx.grade.create({
      data: {
        attemptQuestionId: aq.id,
        score: roundedScore,
        gradedBy: params.examinerId,
        reason: params.reason?.trim() || "Manual grade",
      },
    });

    const siblingQuestions = await tx.attemptQuestion.findMany({
      where: { attemptId: aq.attempt.id },
      include: {
        grades: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    let total = 0;
    let pendingWritten = 0;

    for (const item of siblingQuestions) {
      const latest = item.grades[0];
      if (latest) {
        total += latest.score;
      } else if (item.typeSnapshot === "WRITTEN") {
        pendingWritten += 1;
      }
    }

    await tx.attempt.update({
      where: { id: aq.attempt.id },
      data: {
        totalScore: roundScore(total),
        ...(pendingWritten === 0 ? { status: "GRADED" } : {}),
      },
    });
  });

  return getExaminerGradingAndResults(params.examId);
}

/**
 * Controlled publication gate: blocks publishing if written answers remain
 * ungraded unless the examiner explicitly confirms override.
 */
export async function publishExamResults(examId: string, override = false) {
  const summary = await getExaminerGradingAndResults(examId);

  if (summary.exam.status !== "PUBLISHED") {
    throw new HttpError(
      409,
      "Exam must be published before results can be released",
    );
  }

  if (summary.pendingWrittenAttempts > 0 && !override) {
    throw new HttpError(
      409,
      `${summary.pendingWrittenAttempts} attempt(s) still have ungraded written answers. Complete manual grading or confirm override.`,
      "PENDING_GRADING",
    );
  }

  const updated = await db.exam.update({
    where: { id: examId },
    data: { resultsPublished: true },
    select: { id: true, resultsPublished: true },
  });

  return updated;
}

/**
 * Examiner/Admin retain-and-review page payload for any finalized real attempt.
 * Reused as the base for the Stage 11 dispute evidence pack.
 */
export async function getAttemptReview(examId: string, attemptId: string) {
  await finalizeExpired(examId);

  const attempt = await db.attempt.findFirst({
    where: realAttemptsWhere({ id: attemptId, examId }),
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          totalMarks: true,
          resultsPublished: true,
        },
      },
      candidate: {
        select: { id: true, name: true, email: true },
      },
      questions: {
        orderBy: { position: "asc" },
        include: {
          answer: true,
          grades: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
      incidents: {
        orderBy: { at: "asc" },
      },
      scratchpad: true,
    },
  });

  if (!attempt) {
    throw new HttpError(404, "Attempt not found");
  }

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      deadlineAt: attempt.deadlineAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      totalScore: attempt.totalScore ?? 0,
    },
    exam: attempt.exam,
    candidate: attempt.candidate,
    scratchpadContent: attempt.scratchpad?.content ?? "",
    incidents: attempt.incidents.map((inc) => ({
      id: inc.id,
      type: inc.type,
      detail: inc.detail,
      at: inc.at.toISOString(),
    })),
    questions: attempt.questions.map((aq) => {
      const latest = aq.grades[0] ?? null;
      return {
        attemptQuestionId: aq.id,
        position: aq.position,
        type: aq.typeSnapshot,
        marks: aq.marksSnapshot,
        text: aq.textSnapshot,
        options: parseSnapshotOptions(aq.optionsSnapshot),
        selectedOptionIds: aq.answer
          ? parseSelectedOptionIds(aq.answer.selectedOptionIds)
          : [],
        writtenText: aq.answer?.writtenText ?? null,
        latestScore: latest ? latest.score : null,
        latestReason: latest?.reason ?? null,
        gradeHistory: aq.grades.map((g) => ({
          id: g.id,
          score: g.score,
          reason: g.reason,
          rulingId: g.rulingId,
          createdAt: g.createdAt.toISOString(),
        })),
      };
    }),
  };
}

/**
 * Candidate-facing results view. Strictly hides scores and correct answers
 * until exam.resultsPublished is true.
 */
export async function getCandidateAttemptResult(attemptId: string) {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          totalMarks: true,
          resultsPublished: true,
          rulings: {
            select: {
              id: true,
              sourceQuestionId: true,
              type: true,
              detail: true,
              reason: true,
              createdAt: true,
            },
          },
        },
      },
      questions: {
        orderBy: { position: "asc" },
        include: {
          answer: true,
          grades: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw new HttpError(404, "Attempt not found");
  }

  if (!attempt.exam.resultsPublished) {
    return {
      published: false as const,
      examId: attempt.exam.id,
      examTitle: attempt.exam.title,
      status: attempt.status,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
    };
  }

  let computedTotal = 0;
  const questions = attempt.questions.map((aq) => {
    const latest = aq.grades[0] ?? null;
    if (latest) {
      computedTotal += latest.score;
    }

    const rulingMatches = attempt.exam.rulings.filter(
      (r) => r.sourceQuestionId === aq.sourceQuestionId,
    );
    const alternateIds = new Set<string>();
    for (const r of rulingMatches) {
      if (
        r.type === "ACCEPT_ALTERNATE" &&
        r.detail &&
        typeof r.detail === "object"
      ) {
        const ids = (r.detail as Record<string, unknown>).acceptedOptionIds;
        if (Array.isArray(ids)) {
          for (const id of ids) {
            if (typeof id === "string") alternateIds.add(id);
          }
        }
      }
    }

    const options = parseSnapshotOptions(aq.optionsSnapshot).map((opt) => ({
      id: opt.id,
      text: opt.text,
      isCorrect: opt.isCorrect || alternateIds.has(opt.id),
      acceptedByRuling: !opt.isCorrect && alternateIds.has(opt.id),
    }));

    return {
      attemptQuestionId: aq.id,
      position: aq.position,
      type: aq.typeSnapshot,
      marks: aq.marksSnapshot,
      text: aq.textSnapshot,
      options,
      selectedOptionIds: aq.answer
        ? parseSelectedOptionIds(aq.answer.selectedOptionIds)
        : [],
      writtenText: aq.answer?.writtenText ?? null,
      awardedScore: latest ? latest.score : null,
      feedback: latest?.reason ?? null,
      gradeHistory: aq.grades.map((g) => ({
        id: g.id,
        score: g.score,
        reason: g.reason,
        rulingId: g.rulingId,
        createdAt: g.createdAt.toISOString(),
      })),
    };
  });

  const totalScore = roundScore(computedTotal);
  const percentage =
    attempt.exam.totalMarks > 0
      ? Math.round((totalScore / attempt.exam.totalMarks) * 1000) / 10
      : 0;

  return {
    published: true as const,
    attemptId: attempt.id,
    examId: attempt.exam.id,
    examTitle: attempt.exam.title,
    status: attempt.status,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    totalScore,
    totalMarks: attempt.exam.totalMarks,
    percentage,
    questions,
  };
}
