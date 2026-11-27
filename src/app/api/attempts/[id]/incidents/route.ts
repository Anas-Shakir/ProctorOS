import { NextResponse } from "next/server";
import { recordAttemptIncident } from "@/lib/attempts";
import {
  handleApiError,
  HttpError,
  requireAttemptOwner,
} from "@/lib/permissions";
import { recordIncidentSchema } from "@/lib/validators/attempt";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireAttemptOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = recordIncidentSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid incident payload",
      );
    }

    const result = await recordAttemptIncident(id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
