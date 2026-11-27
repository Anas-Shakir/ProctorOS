import { NextResponse } from "next/server";
import {
  handleApiError,
  HttpError,
  requireExamOwner,
} from "@/lib/permissions";
import { saveManualGrade } from "@/lib/results";
import { manualGradeSchema } from "@/lib/validators/grading";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { user } = await requireExamOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = manualGradeSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid grade payload",
      );
    }

    const updated = await saveManualGrade({
      examId: id,
      examinerId: user.id,
      attemptQuestionId: parsed.data.attemptQuestionId,
      score: parsed.data.score,
      reason: parsed.data.reason,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
