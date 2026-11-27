import { NextResponse } from "next/server";
import { startOrResumeAttempt } from "@/lib/attempts";
import {
  handleApiError,
  HttpError,
  requireEnrollment,
} from "@/lib/permissions";
import { startAttemptSchema } from "@/lib/validators/enrollment";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = startAttemptSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Exam ID is required",
      );
    }

    const { user } = await requireEnrollment(parsed.data.examId);
    const result = await startOrResumeAttempt({
      candidateId: user.id,
      examId: parsed.data.examId,
      isSandbox: false,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
