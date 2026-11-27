import { NextResponse } from "next/server";
import {
  deleteDraftExam,
  getExamWorkspace,
  updateExam,
} from "@/lib/exams";
import { handleApiError, HttpError, requireExamOwner } from "@/lib/permissions";
import { updateExamSchema } from "@/lib/validators/exam";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const workspace = await getExamWorkspace(id);
    return NextResponse.json(workspace);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const body = await request.json().catch(() => null);
    const parsed = updateExamSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid exam update",
      );
    }

    const exam = await updateExam(id, parsed.data);
    return NextResponse.json({ exam });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    await deleteDraftExam(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
