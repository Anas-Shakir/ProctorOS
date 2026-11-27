import { NextResponse } from "next/server";
import { getExamWorkspace, publishExam } from "@/lib/exams";
import { handleApiError, requireExamOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const workspace = await getExamWorkspace(id);
    return NextResponse.json({
      checklist: workspace.checklist,
      serverNow: workspace.serverNow,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const result = await publishExam(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
