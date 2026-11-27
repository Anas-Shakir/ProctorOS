import { NextResponse } from "next/server";
import { handleApiError, HttpError, requireRole } from "@/lib/permissions";
import { importQuestions } from "@/lib/questions";

export async function POST(request: Request) {
  try {
    const user = await requireRole(["EXAMINER", "ADMIN"]);
    const contentType = request.headers.get("content-type") ?? "";

    let fileName = "upload.csv";
    let content = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new HttpError(400, "Attach a CSV or JSON file under 'file'");
      }
      fileName = file.name;
      content = await file.text();
    } else {
      const body = await request.json().catch(() => null);
      if (
        !body ||
        typeof body.content !== "string" ||
        typeof body.fileName !== "string"
      ) {
        throw new HttpError(
          400,
          "Provide { fileName, content } or upload a file via multipart/form-data",
        );
      }
      fileName = body.fileName;
      content = body.content;
    }

    const report = await importQuestions(user.id, fileName, content);
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}
