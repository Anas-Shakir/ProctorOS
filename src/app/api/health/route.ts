import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint verifying PostgreSQL connectivity via Prisma.
 * Used for Stage 0 verification and external keepalive pings.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        ok: true,
        db: "connected",
        serverNow: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/health] Database check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        db: "error",
        error: "Database unreachable",
      },
      { status: 503 },
    );
  }
}
