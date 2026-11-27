import { NextResponse } from "next/server";
import { listAuditLogs } from "@/lib/audit";
import { handleApiError, requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireRole(["EXAMINER", "ADMIN"]);
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitParam) ? limitParam : 50;
    const data = await listAuditLogs(limit);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
