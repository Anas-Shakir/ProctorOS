import { NextResponse } from "next/server";
import type { Difficulty, QuestionType } from "@prisma/client";
import { handleApiError, HttpError, requireRole } from "@/lib/permissions";
import { createQuestion, listQuestions } from "@/lib/questions";
import {
  DifficultyValues,
  questionInputSchema,
  QuestionTypeValues,
} from "@/lib/validators/question";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireRole(["EXAMINER", "ADMIN"]);
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get("topic")?.trim() || undefined;
    const diffParam = searchParams.get("difficulty")?.trim();
    const typeParam = searchParams.get("type")?.trim();
    const search = searchParams.get("q")?.trim() || undefined;

    const difficulty = DifficultyValues.includes(diffParam as Difficulty)
      ? (diffParam as Difficulty)
      : undefined;
    const type = QuestionTypeValues.includes(typeParam as QuestionType)
      ? (typeParam as QuestionType)
      : undefined;

    const questions = await listQuestions(user, {
      topic,
      difficulty,
      type,
      search,
    });
    return NextResponse.json({ questions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["EXAMINER", "ADMIN"]);
    const body = await request.json().catch(() => null);
    const parsed = questionInputSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid question payload",
      );
    }

    const question = await createQuestion(user.id, parsed.data);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
