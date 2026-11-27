import { NextResponse } from "next/server";
import { startCandidateAttempt } from "@/lib/candidate";
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
    const result = await startCandidateAttempt(user.id, parsed.data.examId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
