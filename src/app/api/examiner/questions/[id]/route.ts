import { NextResponse } from "next/server";
import {
  handleApiError,
  HttpError,
  requireQuestionOwner,
} from "@/lib/permissions";
import { deleteQuestion, updateQuestion } from "@/lib/questions";
import { questionInputSchema } from "@/lib/validators/question";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireQuestionOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = questionInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid question update",
      );
    }

    const question = await updateQuestion(id, parsed.data);
    return NextResponse.json({ question });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireQuestionOwner(id);
    await deleteQuestion(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
