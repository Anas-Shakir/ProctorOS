import { NextResponse } from "next/server";
import { handleApiError, requireAttemptOwner } from "@/lib/permissions";
import { getCandidateAttemptResult } from "@/lib/results";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireAttemptOwner(id);
    const data = await getCandidateAttemptResult(id);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
