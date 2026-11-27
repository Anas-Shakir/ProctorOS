import { NextResponse } from "next/server";
import { verifyAuditChain } from "@/lib/audit";
import { handleApiError, requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireRole(["EXAMINER", "ADMIN"]);
    const verification = await verifyAuditChain();
    return NextResponse.json(verification);
  } catch (error) {
    return handleApiError(error);
  }
}
