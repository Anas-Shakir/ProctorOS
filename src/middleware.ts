import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getRoleHome,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";

const PROTECTED_PREFIXES = [
  { prefix: "/admin", role: "ADMIN" as const },
  { prefix: "/examiner", role: "EXAMINER" as const },
  { prefix: "/candidate", role: "CANDIDATE" as const },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(
        new URL(getRoleHome(session.role), request.url),
      );
    }
    return NextResponse.next();
  }

  for (const rule of PROTECTED_PREFIXES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      if (!session) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(loginUrl);
      }
      if (session.role !== rule.role) {
        return NextResponse.redirect(
          new URL(getRoleHome(session.role), request.url),
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/examiner/:path*", "/candidate/:path*"],
};
