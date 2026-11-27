import { db } from "@/lib/db";
import { finalizeExpired } from "@/lib/attempts";
import { parseSelectedOptionIds } from "@/lib/grading";
import { HttpError } from "@/lib/permissions";
import { realAttemptsWhere } from "@/lib/results";
import { getExamStatus, type DerivedExamStatus } from "@/lib/time";

export interface MonitorIncidentItem {
  id: string;
  type: string;
  detail: string | null;
  at: string;
}

export interface MonitorAttemptRow {
  attemptId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  status: string;
  answeredCount: number;
  totalQuestions: number;
  remainingSeconds: number;
  lastActivityAt: string;
  incidentCount: number;
  incidents: MonitorIncidentItem[];
}

export interface AnnouncementItem {
  id: string;
  message: string;
  authorName: string;
  createdAt: string;
}

export interface ExamMonitorState {
  serverNow: string;
  exam: {
    id: string;
    title: string;
    derivedStatus: DerivedExamStatus;
    startTime: string;
    endTime: string;
  };
  attempts: MonitorAttemptRow[];
  announcements: AnnouncementItem[];
}

export async function getExamMonitorState(
  examId: string,
): Promise<ExamMonitorState> {
  await finalizeExpired(examId);
  const serverNow = new Date();

  const [exam, attempts, announcements] = await Promise.all([
    db.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        title: true,
        status: true,
        startTime: true,
        endTime: true,
      },
    }),
    db.attempt.findMany({
      where: realAttemptsWhere({ examId }),
      include: {
        candidate: {
          select: { id: true, name: true, email: true },
        },
        questions: {
          select: {
            id: true,
            answer: {
              select: {
                selectedOptionIds: true,
                writtenText: true,
                savedAt: true,
              },
            },
          },
        },
        incidents: {
          orderBy: { at: "desc" },
        },
      },
      orderBy: [{ startedAt: "desc" }],
    }),
    db.announcement.findMany({
      where: { examId },
      include: {
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!exam) {
    throw new HttpError(404, "Exam not found");
  }

  const monitorAttempts: MonitorAttemptRow[] = attempts.map((attempt) => {
    let answeredCount = 0;
    let lastActivityMs = attempt.startedAt.getTime();

    for (const q of attempt.questions) {
      if (!q.answer) continue;
      const selected = parseSelectedOptionIds(q.answer.selectedOptionIds);
      const hasWritten = Boolean(
        q.answer.writtenText && q.answer.writtenText.trim().length > 0,
      );
      if (selected.length > 0 || hasWritten) {
        answeredCount += 1;
      }
      const savedMs = q.answer.savedAt.getTime();
      if (savedMs > lastActivityMs) {
        lastActivityMs = savedMs;
      }
    }

    const remainingSeconds =
      attempt.status === "IN_PROGRESS"
        ? Math.max(
            0,
            Math.floor(
              (attempt.deadlineAt.getTime() - serverNow.getTime()) / 1000,
            ),
          )
        : 0;

    return {
      attemptId: attempt.id,
      candidateId: attempt.candidate.id,
      candidateName: attempt.candidate.name,
      candidateEmail: attempt.candidate.email,
      status: attempt.status,
      answeredCount,
      totalQuestions: attempt.questions.length,
      remainingSeconds,
      lastActivityAt: new Date(lastActivityMs).toISOString(),
      incidentCount: attempt.incidents.length,
      incidents: attempt.incidents.map((inc) => ({
        id: inc.id,
        type: inc.type,
        detail: inc.detail,
        at: inc.at.toISOString(),
      })),
    };
  });

  return {
    serverNow: serverNow.toISOString(),
    exam: {
      id: exam.id,
      title: exam.title,
      derivedStatus: getExamStatus(exam, serverNow),
      startTime: exam.startTime.toISOString(),
      endTime: exam.endTime.toISOString(),
    },
    attempts: monitorAttempts,
    announcements: announcements.map((a) => ({
      id: a.id,
      message: a.message,
      authorName: a.author.name,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function postExamAnnouncement(params: {
  examId: string;
  authorId: string;
  message: string;
}): Promise<AnnouncementItem[]> {
  await db.announcement.create({
    data: {
      examId: params.examId,
      authorId: params.authorId,
      message: params.message,
    },
  });

  const rows = await db.announcement.findMany({
    where: { examId: params.examId },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((a) => ({
    id: a.id,
    message: a.message,
    authorName: a.author.name,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function listAttemptAnnouncements(
  attemptId: string,
): Promise<AnnouncementItem[]> {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    select: { examId: true },
  });
  if (!attempt) {
    throw new HttpError(404, "Attempt not found");
  }

  const rows = await db.announcement.findMany({
    where: { examId: attempt.examId },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((a) => ({
    id: a.id,
    message: a.message,
    authorName: a.author.name,
    createdAt: a.createdAt.toISOString(),
  }));
}
