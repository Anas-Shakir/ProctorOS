import { NextResponse } from "next/server";
import { createExam, listExaminerExams } from "@/lib/exams";
import { handleApiError, HttpError, requireRole } from "@/lib/permissions";
import { createExamSchema } from "@/lib/validators/exam";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["EXAMINER", "ADMIN"]);
    const result = await listExaminerExams(user);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["EXAMINER", "ADMIN"]);
    const body = await request.json().catch(() => null);
    const parsed = createExamSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid exam configuration",
      );
    }

    const exam = await createExam(user.id, parsed.data);
    return NextResponse.json({ exam }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
