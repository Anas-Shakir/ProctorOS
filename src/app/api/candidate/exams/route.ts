import { NextResponse } from "next/server";
import { listCandidateExams } from "@/lib/candidate";
import { handleApiError, requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const data = await listCandidateExams(user.id);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
