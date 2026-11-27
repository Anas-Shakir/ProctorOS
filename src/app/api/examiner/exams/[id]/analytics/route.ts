import { NextResponse } from "next/server";
import { getExamAnalytics } from "@/lib/analytics";
import { handleApiError, requireExamOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const analytics = await getExamAnalytics(id);
    return NextResponse.json(analytics);
  } catch (error) {
    return handleApiError(error);
  }
}
