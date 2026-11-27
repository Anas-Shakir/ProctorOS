import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SAFE_USER_SELECT } from "@/lib/auth";
import { handleApiError, HttpError, requireRole } from "@/lib/permissions";
import { updateUserSchema } from "@/lib/validators/auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRole(["ADMIN"]);
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid update payload",
      );
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!target) {
      throw new HttpError(404, "User not found");
    }

    if (target.id === actor.id) {
      if (parsed.data.isActive === false) {
        throw new HttpError(400, "You cannot deactivate your own account");
      }
      if (parsed.data.role && parsed.data.role !== "ADMIN") {
        throw new HttpError(400, "You cannot remove your own ADMIN role");
      }
    }

    const user = await db.user.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
      },
      select: SAFE_USER_SELECT,
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
