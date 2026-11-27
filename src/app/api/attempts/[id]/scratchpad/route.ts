import { NextResponse } from "next/server";
import { saveAttemptScratchpad } from "@/lib/attempts";
import {
  handleApiError,
  HttpError,
  requireAttemptOwner,
} from "@/lib/permissions";
import { saveScratchpadSchema } from "@/lib/validators/attempt";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireAttemptOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = saveScratchpadSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid scratchpad payload",
      );
    }

    const result = await saveAttemptScratchpad(id, parsed.data.content);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
