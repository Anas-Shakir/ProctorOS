import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  autoGradeAttempt,
  parseSelectedOptionIds,
  parseSnapshotOptions,
} from "@/lib/grading";
import { HttpError } from "@/lib/permissions";
import { getExamStatus } from "@/lib/time";
import type { z } from "zod";
import type {
  recordIncidentSchema,
  saveAnswerSchema,
} from "@/lib/validators/attempt";

export const LATE_SAVE_GRACE_MS = 3000;

export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type RecordIncidentInput = z.infer<typeof recordIncidentSchema>;

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Conditionally finalize a single IN_PROGRESS attempt if its deadline has passed.
 * Safe under concurrent callers because UPDATE ... WHERE status = 'IN_PROGRESS'
 * succeeds for at most one transaction.
 */
export async function finalizeIfExpired(
  attemptId: string,
  includeGrace = false,
) {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      deadlineAt: true,
      submittedAt: true,
      totalScore: true,
    },
  });

  if (!attempt || attempt.status !== "IN_PROGRESS") {
    return attempt;
  }

  const now = new Date();
  const cutoff =
    attempt.deadlineAt.getTime() + (includeGrace ? LATE_SAVE_GRACE_MS : 0);

  if (now.getTime() <= cutoff) {
    return attempt;
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.attempt.updateMany({
      where: {
        id: attemptId,
        status: "IN_PROGRESS",
      },
      data: {
        status: "AUTO_SUBMITTED",
        submittedAt: attempt.deadlineAt,
      },
    });

    if (updated.count === 1) {
      return autoGradeAttempt(tx, attemptId);
    }

    return tx.attempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        deadlineAt: true,
        submittedAt: true,
        totalScore: true,
      },
    });
  }, { maxWait: 15000, timeout: 30000 });
}

/**
 * Sweep expired IN_PROGRESS attempts for an exam (or globally).
 * Used on examiner monitor, results, and analytics reads instead of cron.
 */
export async function finalizeExpired(examId?: string) {
  const now = new Date();
  const expired = await db.attempt.findMany({
    where: {
      status: "IN_PROGRESS",
      deadlineAt: { lt: now },
      ...(examId ? { examId } : {}),
    },
    select: { id: true },
  });

  for (const item of expired) {
    await finalizeIfExpired(item.id, false);
  }
  return expired.length;
}

/**
 * Start or resume an attempt in one transaction, freezing AttemptQuestion
 * snapshots (with optional shuffling) and enforcing unique realKey.
 */
export async function startOrResumeAttempt(params: {
  candidateId: string;
  examId: string;
  isSandbox?: boolean;
}) {
  const isSandbox = Boolean(params.isSandbox);
  const serverNow = new Date();

  const exam = await db.exam.findUnique({
    where: { id: params.examId },
    include: {
      examQuestions: {
        orderBy: { order: "asc" },
        include: {
          question: {
            include: {
              options: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    throw new HttpError(404, "Exam not found");
  }

  if (!isSandbox) {
    if (exam.status !== "PUBLISHED") {
      throw new HttpError(403, "Exam is not available");
    }
    const derived = getExamStatus(exam, serverNow);
    if (derived === "UPCOMING") {
      throw new HttpError(409, "This exam has not opened yet");
    }
    if (derived === "COMPLETED") {
      throw new HttpError(409, "This exam window has already closed");
    }
  }

  const realKey = isSandbox ? null : `${params.examId}:${params.candidateId}`;

  // If a real attempt already exists and is expired, finalize it before rejecting.
  if (realKey) {
    const existingPre = await db.attempt.findUnique({
      where: { realKey },
      select: { id: true, status: true, deadlineAt: true },
    });
    if (existingPre) {
      const checked = await finalizeIfExpired(existingPre.id, false);
      if (checked && checked.status !== "IN_PROGRESS") {
        throw new HttpError(409, "You have already completed this exam");
      }
    }
  }

  const deadlineAt = isSandbox
    ? new Date(serverNow.getTime() + exam.durationMin * 60_000)
    : new Date(
        Math.min(
          serverNow.getTime() + exam.durationMin * 60_000,
          exam.endTime.getTime(),
        ),
      );

  const orderedExamQuestions = exam.shuffleQuestions
    ? shuffleArray(exam.examQuestions)
    : exam.examQuestions;

  const frozenSnapshots = orderedExamQuestions.map((eq, idx) => {
    const q = eq.question;
    const rawOptions = q.options.map((opt) => ({
      id: opt.id,
      text: opt.text,
      isCorrect: opt.isCorrect,
    }));
    const optionsSnapshot =
      q.type === "WRITTEN"
        ? null
        : exam.shuffleOptions
          ? shuffleArray(rawOptions)
          : rawOptions;

    return {
      position: idx + 1,
      sourceQuestionId: q.id,
      textSnapshot: q.text,
      typeSnapshot: q.type,
      marksSnapshot: eq.marksOverride ?? q.marks,
      optionsSnapshot: optionsSnapshot ?? Prisma.JsonNull,
      multiModeSnapshot: q.multiMode,
    };
  });

  try {
    const attempt = await db.$transaction(async (tx) => {
      if (realKey) {
        const existing = await tx.attempt.findUnique({ where: { realKey } });
        if (existing) {
          if (existing.status !== "IN_PROGRESS") {
            throw new HttpError(409, "You have already completed this exam");
          }
          return existing;
        }
      }

      return tx.attempt.create({
        data: {
          examId: exam.id,
          candidateId: params.candidateId,
          isSandbox,
          realKey,
          status: "IN_PROGRESS",
          startedAt: serverNow,
          deadlineAt,
          questions: {
            create: frozenSnapshots,
          },
          scratchpad: {
            create: { content: "" },
          },
        },
      });
    }, { maxWait: 15000, timeout: 30000 });

    return {
      attempt: {
        id: attempt.id,
        examId: attempt.examId,
        status: attempt.status,
        isSandbox: attempt.isSandbox,
        startedAt: attempt.startedAt.toISOString(),
        deadlineAt: attempt.deadlineAt.toISOString(),
      },
      serverNow: serverNow.toISOString(),
    };
  } catch (error) {
    if (
      realKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const winner = await db.attempt.findUniqueOrThrow({ where: { realKey } });
      if (winner.status !== "IN_PROGRESS") {
        throw new HttpError(409, "You have already completed this exam");
      }
      return {
        attempt: {
          id: winner.id,
          examId: winner.examId,
          status: winner.status,
          isSandbox: winner.isSandbox,
          startedAt: winner.startedAt.toISOString(),
          deadlineAt: winner.deadlineAt.toISOString(),
        },
        serverNow: serverNow.toISOString(),
      };
    }
    throw error;
  }
}

/**
 * Fetch frozen attempt paper for candidate workspace.
 * Lazily finalizes expired attempts and strips `isCorrect` from all options.
 */
export async function getAttemptPaper(attemptId: string) {
  await finalizeIfExpired(attemptId, false);
  const serverNow = new Date();

  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          instructions: true,
          totalMarks: true,
          durationMin: true,
        },
      },
      questions: {
        orderBy: { position: "asc" },
        include: { answer: true },
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
      examId: attempt.examId,
      examTitle: attempt.exam.title,
      instructions: attempt.exam.instructions,
      totalMarks: attempt.exam.totalMarks,
      durationMin: attempt.exam.durationMin,
      status: attempt.status,
      isSandbox: attempt.isSandbox,
      startedAt: attempt.startedAt.toISOString(),
      deadlineAt: attempt.deadlineAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
    },
    serverNow: serverNow.toISOString(),
    questions: attempt.questions.map((q) => {
      // Strip isCorrect strictly so candidate payload never leaks answers
      const safeOptions = parseSnapshotOptions(q.optionsSnapshot).map((o) => ({
        id: o.id,
        text: o.text,
      }));

      return {
        attemptQuestionId: q.id,
        position: q.position,
        type: q.typeSnapshot,
        marks: q.marksSnapshot,
        text: q.textSnapshot,
        options: safeOptions,
        answer: q.answer
          ? {
              selectedOptionIds: parseSelectedOptionIds(
                q.answer.selectedOptionIds,
              ),
              writtenText: q.answer.writtenText,
              markedForReview: q.answer.markedForReview,
              revision: q.answer.revision,
              savedAt: q.answer.savedAt.toISOString(),
            }
          : null,
      };
    }),
    scratchpad: {
      content: attempt.scratchpad?.content ?? "",
      updatedAt: attempt.scratchpad?.updatedAt.toISOString() ?? null,
    },
  };
}

/**
 * Idempotent autosave with server deadline + 3s grace check and monotonic
 * revision ordering. Commits expiry finalization before returning 409.
 */
export async function saveAttemptAnswer(
  attemptId: string,
  input: SaveAnswerInput,
) {
  // Check and persist expiry OUTSIDE the answer transaction so 409 never rolls back AUTO_SUBMITTED.
  const checked = await finalizeIfExpired(attemptId, true);
  if (!checked) {
    throw new HttpError(404, "Attempt not found");
  }
  if (checked.status !== "IN_PROGRESS") {
    throw new HttpError(
      409,
      "Attempt is already finalized; late answers are rejected",
      "ATTEMPT_FINALIZED",
    );
  }

  const serverNow = new Date();
  const question = await db.attemptQuestion.findFirst({
    where: {
      id: input.attemptQuestionId,
      attemptId,
    },
    select: { id: true },
  });

  if (!question) {
    throw new HttpError(404, "Question not found on this attempt");
  }

  const upsertAnswerTx = () =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.answer.findUnique({
          where: { attemptQuestionId: input.attemptQuestionId },
        });

        if (existing && input.revision <= existing.revision) {
          return {
            ok: true,
            ignored: true,
            revision: existing.revision,
            savedAt: existing.savedAt.toISOString(),
            serverNow: serverNow.toISOString(),
            deadlineAt: checked.deadlineAt.toISOString(),
          };
        }

        const saved = existing
          ? await tx.answer.update({
              where: { id: existing.id },
              data: {
                selectedOptionIds: input.selectedOptionIds,
                writtenText: input.writtenText ?? null,
                markedForReview: input.markedForReview,
                revision: input.revision,
                savedAt: serverNow,
              },
            })
          : await tx.answer.create({
              data: {
                attemptQuestionId: input.attemptQuestionId,
                selectedOptionIds: input.selectedOptionIds,
                writtenText: input.writtenText ?? null,
                markedForReview: input.markedForReview,
                revision: input.revision,
                savedAt: serverNow,
              },
            });

        return {
          ok: true,
          ignored: false,
          revision: saved.revision,
          savedAt: saved.savedAt.toISOString(),
          serverNow: serverNow.toISOString(),
          deadlineAt: checked.deadlineAt.toISOString(),
        };
      },
      { maxWait: 15000, timeout: 30000 },
    );

  try {
    return await upsertAnswerTx();
  } catch (error) {
    // Concurrent first-save race on unique attemptQuestionId -> retry once as update
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return upsertAnswerTx();
    }
    throw error;
  }
}

export async function saveAttemptScratchpad(
  attemptId: string,
  content: string,
) {
  const checked = await finalizeIfExpired(attemptId, true);
  if (!checked) {
    throw new HttpError(404, "Attempt not found");
  }
  if (checked.status !== "IN_PROGRESS") {
    throw new HttpError(
      409,
      "Attempt is already finalized",
      "ATTEMPT_FINALIZED",
    );
  }

  const saved = await db.scratchpad.upsert({
    where: { attemptId },
    update: { content },
    create: { attemptId, content },
  });

  return {
    ok: true,
    updatedAt: saved.updatedAt.toISOString(),
  };
}

export async function recordAttemptIncident(
  attemptId: string,
  input: RecordIncidentInput,
) {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, status: true },
  });
  if (!attempt) {
    throw new HttpError(404, "Attempt not found");
  }
  if (attempt.status !== "IN_PROGRESS") {
    return { ok: true, ignored: true };
  }

  const incident = await db.incident.create({
    data: {
      attemptId,
      type: input.type,
      detail: input.detail ?? null,
    },
  });

  return { ok: true, id: incident.id };
}

/**
 * Conditional submit: only transitions IN_PROGRESS -> SUBMITTED once.
 * Concurrent or duplicate calls safely return the stored attempt state.
 */
export async function submitAttempt(attemptId: string) {
  await finalizeIfExpired(attemptId, false);
  const serverNow = new Date();

  return db.$transaction(async (tx) => {
    const transitioned = await tx.attempt.updateMany({
      where: {
        id: attemptId,
        status: "IN_PROGRESS",
      },
      data: {
        status: "SUBMITTED",
        submittedAt: serverNow,
      },
    });

    if (transitioned.count === 1) {
      const graded = await autoGradeAttempt(tx, attemptId);
      if (!graded) {
        throw new HttpError(404, "Attempt not found");
      }
      return {
        ok: true,
        alreadySubmitted: false,
        attempt: {
          id: graded.id,
          status: graded.status,
          submittedAt: graded.submittedAt?.toISOString() ?? null,
        },
      };
    }

    const existing = await tx.attempt.findUnique({
      where: { id: attemptId },
      select: { id: true, status: true, submittedAt: true },
    });
    if (!existing) {
      throw new HttpError(404, "Attempt not found");
    }

    return {
      ok: true,
      alreadySubmitted: true,
      attempt: {
        id: existing.id,
        status: existing.status,
        submittedAt: existing.submittedAt?.toISOString() ?? null,
      },
    };
  }, { maxWait: 15000, timeout: 30000 });
}
