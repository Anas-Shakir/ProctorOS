import { NextResponse } from "next/server";
import { buildCandidateResultPdf } from "@/lib/pdf";
import { handleApiError, requireAttemptViewer } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireAttemptViewer(id);

    const requestOrigin = new URL(request.url).origin;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin;

    const { pdfBytes, filename } = await buildCandidateResultPdf({
      attemptId: id,
      baseUrl,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
