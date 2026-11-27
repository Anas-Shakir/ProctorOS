import { NextResponse } from "next/server";
import { getExaminerDisputesAndRulings } from "@/lib/disputes";
import { handleApiError, requireExamOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const data = await getExaminerDisputesAndRulings(id);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
