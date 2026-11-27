import { NextResponse } from "next/server";
import { verifyReportToken } from "@/lib/verify";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = await verifyReportToken(id);
  return NextResponse.json(payload, {
    status: payload.status === "NOT_FOUND" ? 404 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
