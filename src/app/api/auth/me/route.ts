import { NextResponse } from "next/server";
import { getActiveSessionUser } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getActiveSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  return NextResponse.json({ user });
}
