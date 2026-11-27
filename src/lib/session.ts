import { SignJWT, jwtVerify } from "jose";
import type { AppRole } from "@/lib/validators/auth";

export const SESSION_COOKIE_NAME = "proctoros_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

export interface SessionPayload {
  sub: string;
  role: AppRole;
  email: string;
  name: string;
}

function getSessionSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short");
  }
  return new TextEncoder().encode(secret);
}

/** Sign an HS256 session JWT for an authenticated user. */
export async function signSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({
    role: payload.role,
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecretKey());
}

/** Verify an HS256 session JWT; returns null on invalid or expired tokens. */
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    if (
      payload.role !== "ADMIN" &&
      payload.role !== "EXAMINER" &&
      payload.role !== "CANDIDATE"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

/** Map each role to its canonical home dashboard route. */
export function getRoleHome(role: AppRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "EXAMINER":
      return "/examiner";
    case "CANDIDATE":
      return "/candidate";
  }
}
