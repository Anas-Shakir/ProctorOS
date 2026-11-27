import { NextResponse } from "next/server";
import { resolveExaminerDispute } from "@/lib/disputes";
import {
  handleApiError,
  HttpError,
  requireExamOwner,
} from "@/lib/permissions";
import { resolveDisputeSchema } from "@/lib/validators/dispute";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; disputeId: string }> },
) {
  try {
    const { id, disputeId } = await context.params;
    const { user } = await requireExamOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = resolveDisputeSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid dispute resolution payload",
      );
    }

    const state = await resolveExaminerDispute({
      examId: id,
      examinerId: user.id,
      disputeId,
      decision: parsed.data.decision,
      resolution: parsed.data.resolution,
      newScore: parsed.data.newScore,
    });

    return NextResponse.json(state);
  } catch (error) {
    return handleApiError(error);
  }
}
