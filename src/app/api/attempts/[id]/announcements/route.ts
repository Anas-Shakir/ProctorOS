import { NextResponse } from "next/server";
import { listAttemptAnnouncements } from "@/lib/monitor";
import { handleApiError, requireAttemptOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireAttemptOwner(id);
    const announcements = await listAttemptAnnouncements(id);
    return NextResponse.json({ announcements });
  } catch (error) {
    return handleApiError(error);
  }
}
