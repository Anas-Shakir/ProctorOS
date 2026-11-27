import type { ExamStatus } from "@prisma/client";

export type DerivedExamStatus = "DRAFT" | "UPCOMING" | "ONGOING" | "COMPLETED";

/**
 * Single source of truth for exam lifecycle status.
 * Stored DB status is only DRAFT or PUBLISHED; ONGOING and COMPLETED
 * are always computed from server time so client clocks cannot drift state.
 */
export function getExamStatus(
  exam: { status: ExamStatus; startTime: Date; endTime: Date },
  serverNow: Date = new Date(),
): DerivedExamStatus {
  if (exam.status === "DRAFT") {
    return "DRAFT";
  }
  if (serverNow.getTime() < exam.startTime.getTime()) {
    return "UPCOMING";
  }
  if (serverNow.getTime() <= exam.endTime.getTime()) {
    return "ONGOING";
  }
  return "COMPLETED";
}

export interface PublishChecklist {
  canPublish: boolean;
  alreadyPublished: boolean;
  questionCount: number;
  assignedMarks: number;
  totalMarks: number;
  enrollmentCount: number;
  checks: Array<{
    key: string;
    label: string;
    ok: boolean;
    message?: string;
  }>;
  warnings: string[];
}

export function evaluatePublishChecklist(params: {
  status: ExamStatus;
  startTime: Date;
  endTime: Date;
  durationMin: number;
  totalMarks: number;
  questionCount: number;
  assignedMarks: number;
  enrollmentCount: number;
}): PublishChecklist {
  const windowMinutes = Math.floor(
    (params.endTime.getTime() - params.startTime.getTime()) / 60000,
  );
  const hasQuestions = params.questionCount > 0;
  const marksMatch = Math.abs(params.assignedMarks - params.totalMarks) < 0.001;
  const validWindow =
    params.endTime.getTime() > params.startTime.getTime() &&
    params.durationMin > 0 &&
    params.durationMin <= windowMinutes;

  const checks = [
    {
      key: "questions",
      label: "At least 1 question assigned",
      ok: hasQuestions,
      message: hasQuestions
        ? `${params.questionCount} question(s) assigned`
        : "Add at least one question before publishing.",
    },
    {
      key: "marks",
      label: "Question marks equal exam total",
      ok: marksMatch,
      message: marksMatch
        ? `${params.assignedMarks} / ${params.totalMarks} marks matched`
        : `Assigned marks (${params.assignedMarks}) must equal exam total (${params.totalMarks}).`,
    },
    {
      key: "window",
      label: "Valid exam window and duration",
      ok: validWindow,
      message: validWindow
        ? `${params.durationMin} min inside ${windowMinutes} min window`
        : "End time must be after start time and duration must fit within the window.",
    },
  ];

  const warnings: string[] = [];
  if (params.enrollmentCount === 0) {
    warnings.push(
      "No candidates are enrolled yet. Candidates will not see this exam until enrolled.",
    );
  }

  return {
    canPublish:
      params.status === "DRAFT" && hasQuestions && marksMatch && validWindow,
    alreadyPublished: params.status === "PUBLISHED",
    questionCount: params.questionCount,
    assignedMarks: params.assignedMarks,
    totalMarks: params.totalMarks,
    enrollmentCount: params.enrollmentCount,
    checks,
    warnings,
  };
}
