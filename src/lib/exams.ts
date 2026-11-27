import { db } from "@/lib/db";
import { HttpError } from "@/lib/permissions";
import { evaluatePublishChecklist, getExamStatus } from "@/lib/time";
import type { z } from "zod";
import type {
  createExamSchema,
  examQuestionActionSchema,
  updateExamSchema,
} from "@/lib/validators/exam";
import type { Role } from "@prisma/client";

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type ExamQuestionAction = z.infer<typeof examQuestionActionSchema>;

export async function listExaminerExams(actor: { id: string; role: Role }) {
  const serverNow = new Date();
  const exams = await db.exam.findMany({
    where: actor.role === "ADMIN" ? {} : { ownerId: actor.id },
    include: {
      examQuestions: {
        select: {
          marksOverride: true,
          question: { select: { marks: true } },
        },
      },
      _count: {
        select: {
          examQuestions: true,
          enrollments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    serverNow: serverNow.toISOString(),
    exams: exams.map((exam) => {
      const assignedMarks = exam.examQuestions.reduce(
        (sum, eq) => sum + (eq.marksOverride ?? eq.question.marks),
        0,
      );
      return {
        id: exam.id,
        ownerId: exam.ownerId,
        title: exam.title,
        instructions: exam.instructions,
        startTime: exam.startTime,
        endTime: exam.endTime,
        durationMin: exam.durationMin,
        totalMarks: exam.totalMarks,
        assignedMarks,
        status: exam.status,
        derivedStatus: getExamStatus(exam, serverNow),
        publishedAt: exam.publishedAt,
        shuffleQuestions: exam.shuffleQuestions,
        shuffleOptions: exam.shuffleOptions,
        negativeMarking: exam.negativeMarking,
        resultsPublished: exam.resultsPublished,
        questionCount: exam._count.examQuestions,
        enrollmentCount: exam._count.enrollments,
        createdAt: exam.createdAt,
      };
    }),
  };
}

export async function getExamWorkspace(examId: string) {
  const serverNow = new Date();
  const exam = await db.exam.findUnique({
    where: { id: examId },
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
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!exam) {
    throw new HttpError(404, "Exam not found");
  }

  const assignedMarks = exam.examQuestions.reduce(
    (sum, eq) => sum + (eq.marksOverride ?? eq.question.marks),
    0,
  );

  const checklist = evaluatePublishChecklist({
    status: exam.status,
    startTime: exam.startTime,
    endTime: exam.endTime,
    durationMin: exam.durationMin,
    totalMarks: exam.totalMarks,
    questionCount: exam.examQuestions.length,
    assignedMarks,
    enrollmentCount: exam._count.enrollments,
  });

  return {
    serverNow: serverNow.toISOString(),
    exam: {
      id: exam.id,
      ownerId: exam.ownerId,
      title: exam.title,
      instructions: exam.instructions,
      startTime: exam.startTime,
      endTime: exam.endTime,
      durationMin: exam.durationMin,
      totalMarks: exam.totalMarks,
      assignedMarks,
      status: exam.status,
      derivedStatus: getExamStatus(exam, serverNow),
      publishedAt: exam.publishedAt,
      shuffleQuestions: exam.shuffleQuestions,
      shuffleOptions: exam.shuffleOptions,
      negativeMarking: exam.negativeMarking,
      resultsPublished: exam.resultsPublished,
      enrollmentCount: exam._count.enrollments,
      examQuestions: exam.examQuestions.map((eq) => ({
        id: eq.id,
        questionId: eq.questionId,
        order: eq.order,
        marksOverride: eq.marksOverride,
        effectiveMarks: eq.marksOverride ?? eq.question.marks,
        question: eq.question,
      })),
    },
    checklist,
  };
}

export async function createExam(ownerId: string, input: CreateExamInput) {
  return db.exam.create({
    data: {
      ownerId,
      title: input.title,
      instructions: input.instructions,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMin: input.durationMin,
      totalMarks: input.totalMarks,
      shuffleQuestions: input.shuffleQuestions,
      shuffleOptions: input.shuffleOptions,
      negativeMarking: input.negativeMarking,
      status: "DRAFT",
    },
  });
}

export async function updateExam(examId: string, input: UpdateExamInput) {
  const existing = await db.exam.findUnique({ where: { id: examId } });
  if (!existing) {
    throw new HttpError(404, "Exam not found");
  }

  const serverNow = new Date();
  const derived = getExamStatus(existing, serverNow);

  if (derived === "ONGOING" || derived === "COMPLETED") {
    throw new HttpError(
      409,
      "Cannot edit an exam once its scheduled window has started.",
    );
  }

  if (existing.status === "PUBLISHED") {
    const lockedChanged =
      input.totalMarks !== undefined ||
      input.startTime !== undefined ||
      input.endTime !== undefined ||
      input.durationMin !== undefined ||
      input.negativeMarking !== undefined ||
      input.shuffleQuestions !== undefined ||
      input.shuffleOptions !== undefined;

    if (lockedChanged) {
      throw new HttpError(
        409,
        "Published exams cannot change marks, time window, duration, or shuffling.",
      );
    }
  }

  const nextStart = input.startTime ?? existing.startTime;
  const nextEnd = input.endTime ?? existing.endTime;
  const nextDuration = input.durationMin ?? existing.durationMin;

  if (nextEnd.getTime() <= nextStart.getTime()) {
    throw new HttpError(400, "End time must be after start time");
  }
  const windowMin = Math.floor(
    (nextEnd.getTime() - nextStart.getTime()) / 60000,
  );
  if (nextDuration > windowMin) {
    throw new HttpError(
      400,
      `Duration (${nextDuration} min) cannot exceed the exam window (${windowMin} min)`,
    );
  }

  return db.exam.update({
    where: { id: examId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.instructions !== undefined
        ? { instructions: input.instructions }
        : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.durationMin !== undefined
        ? { durationMin: input.durationMin }
        : {}),
      ...(input.totalMarks !== undefined
        ? { totalMarks: input.totalMarks }
        : {}),
      ...(input.shuffleQuestions !== undefined
        ? { shuffleQuestions: input.shuffleQuestions }
        : {}),
      ...(input.shuffleOptions !== undefined
        ? { shuffleOptions: input.shuffleOptions }
        : {}),
      ...(input.negativeMarking !== undefined
        ? { negativeMarking: input.negativeMarking }
        : {}),
    },
  });
}

export async function deleteDraftExam(examId: string) {
  const existing = await db.exam.findUnique({ where: { id: examId } });
  if (!existing) throw new HttpError(404, "Exam not found");
  if (existing.status !== "DRAFT") {
    throw new HttpError(409, "Only DRAFT exams can be deleted");
  }
  await db.exam.delete({ where: { id: examId } });
}

export async function publishExam(examId: string) {
  const workspace = await getExamWorkspace(examId);
  if (workspace.checklist.alreadyPublished) {
    throw new HttpError(409, "Exam is already published");
  }
  if (!workspace.checklist.canPublish) {
    const failedMessages = workspace.checklist.checks
      .filter((c) => !c.ok)
      .map((c) => c.message ?? c.label)
      .join(" ");
    throw new HttpError(400, failedMessages || "Exam failed publish checks");
  }

  const updated = await db.exam.update({
    where: { id: examId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  return {
    exam: updated,
    derivedStatus: getExamStatus(updated, new Date()),
  };
}

export async function mutateExamQuestions(
  examId: string,
  ownerId: string,
  role: Role,
  payload: ExamQuestionAction,
) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      examQuestions: { orderBy: { order: "asc" } },
    },
  });
  if (!exam) throw new HttpError(404, "Exam not found");
  if (exam.status !== "DRAFT") {
    throw new HttpError(
      409,
      "Cannot add, remove, or reorder questions after publishing",
    );
  }

  if (payload.action === "add") {
    const existingIds = new Set(exam.examQuestions.map((eq) => eq.questionId));
    const toAddIds = payload.questionIds.filter((id) => !existingIds.has(id));
    if (toAddIds.length > 0) {
      const ownedQuestions = await db.question.findMany({
        where: {
          id: { in: toAddIds },
          ...(role === "ADMIN" ? {} : { ownerId }),
        },
        select: { id: true },
      });

      if (ownedQuestions.length !== toAddIds.length) {
        throw new HttpError(
          403,
          "One or more selected questions do not belong to you",
        );
      }

      const startOrder = exam.examQuestions.length + 1;
      await db.examQuestion.createMany({
        data: toAddIds.map((questionId, idx) => ({
          examId,
          questionId,
          order: startOrder + idx,
        })),
      });
    }
  } else if (payload.action === "remove") {
    await db.examQuestion.deleteMany({
      where: { id: payload.examQuestionId, examId },
    });
    const remaining = await db.examQuestion.findMany({
      where: { examId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    await db.$transaction(
      remaining.map((item, idx) =>
        db.examQuestion.update({
          where: { id: item.id },
          data: { order: idx + 1 },
        }),
      ),
    );
  } else if (payload.action === "reorder") {
    const validIds = new Set(exam.examQuestions.map((eq) => eq.id));
    const filtered = payload.orderedIds.filter((id) => validIds.has(id));
    await db.$transaction(
      filtered.map((id, idx) =>
        db.examQuestion.update({
          where: { id },
          data: { order: idx + 1 },
        }),
      ),
    );
  } else if (payload.action === "setMarks") {
    await db.examQuestion.updateMany({
      where: { id: payload.examQuestionId, examId },
      data: { marksOverride: payload.marksOverride },
    });
  }

  return getExamWorkspace(examId);
}
