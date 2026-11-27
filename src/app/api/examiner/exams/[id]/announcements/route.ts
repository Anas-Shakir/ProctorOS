import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postExamAnnouncement } from "@/lib/monitor";
import {
  handleApiError,
  HttpError,
  requireExamOwner,
} from "@/lib/permissions";
import { createAnnouncementSchema } from "@/lib/validators/monitor";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await requireExamOwner(id);

    const rows = await db.announcement.findMany({
      where: { examId: id },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      announcements: rows.map((a) => ({
        id: a.id,
        message: a.message,
        authorName: a.author.name,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { user } = await requireExamOwner(id);

    const body = await request.json().catch(() => null);
    const parsed = createAnnouncementSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid announcement message",
      );
    }

    const announcements = await postExamAnnouncement({
      examId: id,
      authorId: user.id,
      message: parsed.data.message,
    });
    return NextResponse.json({ announcements }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
