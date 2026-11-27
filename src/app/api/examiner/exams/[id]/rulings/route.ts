import { NextResponse } from "next/server";
import {
  applyQuestionRuling,
  getExaminerDisputesAndRulings,
} from "@/lib/disputes";
import {
  handleApiError,
  HttpError,
  requireExamOwner,
} from "@/lib/permissions";
import { createRulingSchema } from "@/lib/validators/dispute";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const data = await getExaminerDisputesAndRulings(id);
    return NextResponse.json({
      rulings: data.rulings,
      questionTargets: data.questionTargets,
    });
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
    const { user } = await requireExamOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = createRulingSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid ruling payload",
      );
    }

    const result = await applyQuestionRuling({
      examId: id,
      examinerId: user.id,
      sourceQuestionId: parsed.data.sourceQuestionId,
      type: parsed.data.type,
      acceptedOptionIds: parsed.data.acceptedOptionIds,
      reason: parsed.data.reason,
      disputeId: parsed.data.disputeId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
