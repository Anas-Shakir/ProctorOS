import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/permissions";
import { getExamStatus, type DerivedExamStatus } from "@/lib/time";

export type CandidateAccessStatus =
  | "NOT_OPEN_YET"
  | "OPEN"
  | "IN_PROGRESS"
  | "CLOSED"
  | "SUBMITTED";

export interface CandidateExamCard {
  examId: string;
  title: string;
  instructions: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  totalMarks: number;
  derivedStatus: DerivedExamStatus;
  accessStatus: CandidateAccessStatus;
  attemptId: string | null;
  attemptStatus: string | null;
  deadlineAt: string | null;
}

export async function listCandidateExams(candidateId: string): Promise<{
  serverNow: string;
  exams: CandidateExamCard[];
}> {
  const serverNow = new Date();
  const [enrollments, attempts] = await Promise.all([
    db.enrollment.findMany({
      where: {
        candidateId,
        exam: { status: "PUBLISHED" },
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            instructions: true,
            startTime: true,
            endTime: true,
            durationMin: true,
            totalMarks: true,
            status: true,
          },
        },
      },
      orderBy: { exam: { startTime: "asc" } },
    }),
    db.attempt.findMany({
      where: {
        candidateId,
        isSandbox: false,
      },
      select: {
        id: true,
        examId: true,
        status: true,
        deadlineAt: true,
      },
    }),
  ]);

  const attemptByExam = new Map(attempts.map((a) => [a.examId, a]));

  const exams: CandidateExamCard[] = enrollments.map(({ exam }) => {
    const derivedStatus = getExamStatus(exam, serverNow);
    const attempt = attemptByExam.get(exam.id) ?? null;

    let accessStatus: CandidateAccessStatus;
    if (
      attempt &&
      (attempt.status === "SUBMITTED" ||
        attempt.status === "AUTO_SUBMITTED" ||
        attempt.status === "GRADED")
    ) {
      accessStatus = "SUBMITTED";
    } else if (
      attempt &&
      attempt.status === "IN_PROGRESS" &&
      derivedStatus === "ONGOING" &&
      serverNow.getTime() <= attempt.deadlineAt.getTime()
    ) {
      accessStatus = "IN_PROGRESS";
    } else if (derivedStatus === "UPCOMING") {
      accessStatus = "NOT_OPEN_YET";
    } else if (derivedStatus === "ONGOING") {
      accessStatus = "OPEN";
    } else {
      accessStatus = attempt ? "SUBMITTED" : "CLOSED";
    }

    return {
      examId: exam.id,
      title: exam.title,
      instructions: exam.instructions,
      startTime: exam.startTime.toISOString(),
      endTime: exam.endTime.toISOString(),
      durationMin: exam.durationMin,
      totalMarks: exam.totalMarks,
      derivedStatus,
      accessStatus,
      attemptId: attempt?.id ?? null,
      attemptStatus: attempt?.status ?? null,
      deadlineAt: attempt?.deadlineAt.toISOString() ?? null,
    };
  });

  return {
    serverNow: serverNow.toISOString(),
    exams,
  };
}

/**
 * Server-side entry gate for `POST /api/attempts/start`.
 * Enforces PUBLISHED status and server-time exam window after enrollment check.
 * Stage 5 will layer AttemptQuestion snapshot creation into this transaction.
 */
export async function startCandidateAttempt(
  candidateId: string,
  examId: string,
) {
  const serverNow = new Date();
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      durationMin: true,
    },
  });

  if (!exam || exam.status !== "PUBLISHED") {
    throw new HttpError(403, "Exam is not available");
  }

  const derived = getExamStatus(exam, serverNow);
  if (derived === "UPCOMING") {
    throw new HttpError(409, "This exam has not opened yet");
  }
  if (derived === "COMPLETED") {
    throw new HttpError(409, "This exam window has already closed");
  }

  const realKey = `${examId}:${candidateId}`;
  const computedDeadline = new Date(
    Math.min(
      serverNow.getTime() + exam.durationMin * 60_000,
      exam.endTime.getTime(),
    ),
  );

  try {
    const attempt = await db.$transaction(async (tx) => {
      const existing = await tx.attempt.findUnique({ where: { realKey } });
      if (existing) {
        if (existing.status !== "IN_PROGRESS") {
          throw new HttpError(409, "You have already completed this exam");
        }
        return existing;
      }

      return tx.attempt.create({
        data: {
          examId,
          candidateId,
          isSandbox: false,
          realKey,
          status: "IN_PROGRESS",
          startedAt: serverNow,
          deadlineAt: computedDeadline,
        },
      });
    });

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
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.attempt.findUniqueOrThrow({
        where: { realKey },
      });
      if (existing.status !== "IN_PROGRESS") {
        throw new HttpError(409, "You have already completed this exam");
      }
      return {
        attempt: {
          id: existing.id,
          examId: existing.examId,
          status: existing.status,
          isSandbox: existing.isSandbox,
          startedAt: existing.startedAt.toISOString(),
          deadlineAt: existing.deadlineAt.toISOString(),
        },
        serverNow: serverNow.toISOString(),
      };
    }
    throw error;
  }
}
