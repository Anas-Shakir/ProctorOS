import { NextResponse } from "next/server";
import {
  handleApiError,
  HttpError,
  requireRole,
} from "@/lib/permissions";
import {
  getUserWorkspacePrefs,
  saveUserWorkspacePrefs,
} from "@/lib/prefs";
import { workspacePrefsSchema } from "@/lib/validators/prefs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["ADMIN", "EXAMINER", "CANDIDATE"]);
    const prefs = await getUserWorkspacePrefs(user.id);
    return NextResponse.json({ prefs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireRole(["ADMIN", "EXAMINER", "CANDIDATE"]);
    const body = await request.json().catch(() => null);
    const parsed = workspacePrefsSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid preferences",
      );
    }

    const prefs = await saveUserWorkspacePrefs(user.id, parsed.data);
    return NextResponse.json({ prefs });
  } catch (error) {
    return handleApiError(error);
  }
}
