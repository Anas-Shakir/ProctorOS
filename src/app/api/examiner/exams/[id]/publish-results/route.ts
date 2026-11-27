import { NextResponse } from "next/server";
import {
  handleApiError,
  HttpError,
  requireExamOwner,
} from "@/lib/permissions";
import { publishExamResults } from "@/lib/results";
import { publishResultsSchema } from "@/lib/validators/grading";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { user } = await requireExamOwner(id);

    const body = await request.json().catch(() => ({}));
    const parsed = publishResultsSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid publication request");
    }

    const result = await publishExamResults(id, parsed.data.override, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
