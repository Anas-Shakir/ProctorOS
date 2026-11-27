import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError, requireExamOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const exam = await db.exam.findUnique({ where: { id } });
    return NextResponse.json({ exam });
  } catch (error) {
    return handleApiError(error);
  }
}
