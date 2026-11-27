import { NextResponse } from "next/server";
import { importAndEnrollCandidates } from "@/lib/enrollments";
import { handleApiError, HttpError, requireExamOwner } from "@/lib/permissions";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);

    const contentType = request.headers.get("content-type") ?? "";
    let csvContent = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new HttpError(400, "Attach a CSV file under 'file'");
      }
      csvContent = await file.text();
    } else {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.content !== "string") {
        throw new HttpError(
          400,
          "Provide { content } or upload a CSV file via multipart/form-data",
        );
      }
      csvContent = body.content;
    }

    const report = await importAndEnrollCandidates(id, csvContent);
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}
