import { NextResponse } from "next/server";
import { getAttemptPaper } from "@/lib/attempts";
import { handleApiError, requireAttemptOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireAttemptOwner(id);
    const paper = await getAttemptPaper(id);
    return NextResponse.json(paper);
  } catch (error) {
    return handleApiError(error);
  }
}
