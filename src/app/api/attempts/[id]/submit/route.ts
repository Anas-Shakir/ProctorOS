import { NextResponse } from "next/server";
import { submitAttempt } from "@/lib/attempts";
import { handleApiError, requireAttemptOwner } from "@/lib/permissions";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireAttemptOwner(id);
    const result = await submitAttempt(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
