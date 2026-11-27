import type { Difficulty, QuestionType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/permissions";
import { parseQuestionImportFile } from "@/lib/importer";
import type { QuestionInput } from "@/lib/validators/question";

export async function listQuestions(
  actor: { id: string; role: Role },
  filters?: {
    topic?: string;
    difficulty?: Difficulty;
    type?: QuestionType;
    search?: string;
  },
) {
  const questions = await db.question.findMany({
    where: {
      ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }),
      ...(filters?.topic ? { topic: filters.topic } : {}),
      ...(filters?.difficulty ? { difficulty: filters.difficulty } : {}),
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.search
        ? {
            OR: [
              { text: { contains: filters.search, mode: "insensitive" } },
              { topic: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      options: { orderBy: { order: "asc" } },
      _count: { select: { examQuestions: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return questions;
}

export async function createQuestion(ownerId: string, input: QuestionInput) {
  return db.question.create({
    data: {
      ownerId,
      topic: input.topic,
      difficulty: input.difficulty,
      type: input.type,
      text: input.text,
      marks: input.marks,
      multiMode: input.multiMode,
      options: {
        create: input.options.map((opt, idx) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
          order: idx,
        })),
      },
    },
    include: {
      options: { orderBy: { order: "asc" } },
      _count: { select: { examQuestions: true } },
    },
  });
}

export async function updateQuestion(questionId: string, input: QuestionInput) {
  return db.$transaction(async (tx) => {
    await tx.option.deleteMany({ where: { questionId } });
    return tx.question.update({
      where: { id: questionId },
      data: {
        topic: input.topic,
        difficulty: input.difficulty,
        type: input.type,
        text: input.text,
        marks: input.marks,
        multiMode: input.multiMode,
        version: { increment: 1 },
        options: {
          create: input.options.map((opt, idx) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: idx,
          })),
        },
      },
      include: {
        options: { orderBy: { order: "asc" } },
        _count: { select: { examQuestions: true } },
      },
    });
  });
}

export async function deleteQuestion(questionId: string) {
  const publishedLinks = await db.examQuestion.count({
    where: {
      questionId,
      exam: { status: "PUBLISHED" },
    },
  });

  if (publishedLinks > 0) {
    throw new HttpError(
      409,
      "Cannot delete a question used in a published exam",
    );
  }

  await db.examQuestion.deleteMany({ where: { questionId } });
  await db.question.delete({ where: { id: questionId } });
}

export async function importQuestions(
  ownerId: string,
  fileName: string,
  content: string,
) {
  const { validRows, failed } = parseQuestionImportFile(fileName, content);

  if (validRows.length > 0) {
    await db.$transaction(
      validRows.map((q) =>
        db.question.create({
          data: {
            ownerId,
            topic: q.topic,
            difficulty: q.difficulty,
            type: q.type,
            text: q.text,
            marks: q.marks,
            multiMode: q.multiMode,
            options: {
              create: q.options.map((opt, idx) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
                order: idx,
              })),
            },
          },
        }),
      ),
    );
  }

  return {
    imported: validRows.length,
    failed,
  };
}
