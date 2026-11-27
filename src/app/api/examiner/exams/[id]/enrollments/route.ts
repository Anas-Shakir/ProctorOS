import { NextResponse } from "next/server";
import {
  enrollCandidatesByIds,
  listExamEnrollments,
  removeEnrollment,
} from "@/lib/enrollments";
import { handleApiError, HttpError, requireExamOwner } from "@/lib/permissions";
import {
  enrollCandidatesSchema,
  removeEnrollmentSchema,
} from "@/lib/validators/enrollment";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);
    const data = await listExamEnrollments(id);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = enrollCandidatesSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid enrollment request",
      );
    }

    const data = await enrollCandidatesByIds(id, parsed.data.candidateIds);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = removeEnrollmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Candidate ID is required",
      );
    }

    const data = await removeEnrollment(id, parsed.data.candidateId);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
