import { db } from "@/lib/db";
import { getExamStatus, type DerivedExamStatus } from "@/lib/time";
export { startOrResumeAttempt } from "@/lib/attempts";

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
  resultsPublished: boolean;
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
            resultsPublished: true,
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
      resultsPublished: exam.resultsPublished,
    };
  });

  return {
    serverNow: serverNow.toISOString(),
    exams,
  };
}
