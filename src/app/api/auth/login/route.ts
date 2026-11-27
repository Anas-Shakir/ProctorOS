import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  checkLoginRateLimit,
  resetLoginRateLimit,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { getRoleHome, signSessionToken } from "@/lib/session";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid login input" },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const forwardedFor = request.headers.get("x-forwarded-for") ?? "local";
    const clientIp = forwardedFor.split(",")[0]?.trim() || "local";
    const rateKey = `${clientIp}:${email}`;

    const rate = checkLoginRateLimit(rateKey);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Try again in ${rate.retryAfterSec}s.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec ?? 60) },
        },
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Contact an administrator." },
        { status: 403 },
      );
    }

    resetLoginRateLimit(rateKey);

    const token = await signSessionToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      redirectTo: getRoleHome(user.role),
    });
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
