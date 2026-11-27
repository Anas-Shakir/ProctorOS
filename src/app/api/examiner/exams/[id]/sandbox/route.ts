import { NextResponse } from "next/server";
import { handleApiError, requireExamOwner } from "@/lib/permissions";
import {
  resetSandboxAttempts,
  startOrResumeSandboxAttempt,
} from "@/lib/sandbox";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { user } = await requireExamOwner(id);
    const result = await startOrResumeSandboxAttempt(id, user.id);
    return NextResponse.json(result);
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
    const { user } = await requireExamOwner(id);
    const result = await resetSandboxAttempts(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
