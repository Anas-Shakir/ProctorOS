import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError, requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["EXAMINER", "ADMIN"]);
    const exams = await db.exam.findMany({
      where: user.role === "ADMIN" ? {} : { ownerId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ exams });
  } catch (error) {
    return handleApiError(error);
  }
}
