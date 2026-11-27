import { NextResponse } from "next/server";
import { saveAttemptAnswer } from "@/lib/attempts";
import {
  handleApiError,
  HttpError,
  requireAttemptOwner,
} from "@/lib/permissions";
import { saveAnswerSchema } from "@/lib/validators/attempt";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireAttemptOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = saveAnswerSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid answer payload",
      );
    }

    const result = await saveAttemptAnswer(id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
