import { NextResponse } from "next/server";
import { handleApiError, requireExamOwner } from "@/lib/permissions";
import { getExaminerGradingAndResults } from "@/lib/results";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const data = await getExaminerGradingAndResults(id);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
