import { NextResponse } from "next/server";
import {
  createCandidateDispute,
  getCandidateAttemptDisputes,
} from "@/lib/disputes";
import {
  handleApiError,
  HttpError,
  requireAttemptOwner,
} from "@/lib/permissions";
import { createDisputeSchema } from "@/lib/validators/dispute";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { user, attempt } = await requireAttemptOwner(id);
    if (user.role !== "CANDIDATE" || attempt.isSandbox) {
      throw new HttpError(403, "Only candidate attempt owners may view disputes");
    }
    const disputes = await getCandidateAttemptDisputes(id, user.id);
    return NextResponse.json({ disputes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { user, attempt } = await requireAttemptOwner(id);
    if (user.role !== "CANDIDATE" || attempt.isSandbox) {
      throw new HttpError(403, "Only candidate attempt owners may file disputes");
    }

    const body = await request.json().catch(() => null);
    const parsed = createDisputeSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid dispute submission",
      );
    }

    const dispute = await createCandidateDispute({
      attemptId: id,
      candidateId: user.id,
      attemptQuestionId: parsed.data.attemptQuestionId,
      category: parsed.data.category,
      message: parsed.data.message,
    });

    return NextResponse.json({ dispute }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
