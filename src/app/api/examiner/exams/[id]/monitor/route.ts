import { NextResponse } from "next/server";
import { getExamMonitorState } from "@/lib/monitor";
import { handleApiError, requireExamOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const state = await getExamMonitorState(id);
    return NextResponse.json(state);
  } catch (error) {
    return handleApiError(error);
  }
}
