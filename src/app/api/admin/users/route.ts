import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, SAFE_USER_SELECT } from "@/lib/auth";
import { handleApiError, HttpError, requireRole } from "@/lib/permissions";
import { createUserSchema } from "@/lib/validators/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const users = await db.user.findMany({
      select: SAFE_USER_SELECT,
      orderBy: [{ createdAt: "desc" }],
    });
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["ADMIN"]);
    const body = await request.json().catch(() => null);
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid user payload",
      );
    }

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });

    if (existing) {
      throw new HttpError(409, "A user with this email already exists");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
        isActive: true,
      },
      select: SAFE_USER_SELECT,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
