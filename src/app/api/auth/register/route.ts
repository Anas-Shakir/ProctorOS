import { NextResponse } from "next/server";

/** Public self-registration is disabled by Stage 1 policy. */
export async function POST() {
  return NextResponse.json(
    { error: "Public registration is disabled. Contact an administrator." },
    { status: 403 },
  );
}
