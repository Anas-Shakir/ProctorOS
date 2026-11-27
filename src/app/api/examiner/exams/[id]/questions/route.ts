import { NextResponse } from "next/server";
import { mutateExamQuestions } from "@/lib/exams";
import { handleApiError, HttpError, requireExamOwner } from "@/lib/permissions";
import { examQuestionActionSchema } from "@/lib/validators/exam";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { user } = await requireExamOwner(id);
    const body = await request.json().catch(() => null);
    const parsed = examQuestionActionSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid exam question request",
      );
    }

    const workspace = await mutateExamQuestions(
      id,
      user.id,
      user.role,
      parsed.data,
    );
    return NextResponse.json(workspace);
  } catch (error) {
    return handleApiError(error);
  }
}
