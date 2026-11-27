import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ActiveUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

/**
 * Resolve the signed session cookie and re-verify active status in Postgres.
 * Ensures deactivated accounts lose API access immediately even with an existing cookie.
 */
export async function getActiveSessionUser(): Promise<ActiveUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) return null;
  return user;
}

/** Require an authenticated, active user whose role is in `allowedRoles`. */
export async function requireRole(allowedRoles: Role[]): Promise<ActiveUser> {
  const user = await getActiveSessionUser();
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }
  if (!allowedRoles.includes(user.role)) {
    throw new HttpError(403, "Insufficient permissions");
  }
  return user;
}

/** Require EXAMINER who owns the exam (or ADMIN). */
export async function requireExamOwner(examId: string) {
  const user = await requireRole(["EXAMINER", "ADMIN"]);
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      ownerId: true,
      title: true,
      status: true,
    },
  });

  if (!exam) {
    throw new HttpError(404, "Exam not found");
  }

  if (user.role !== "ADMIN" && exam.ownerId !== user.id) {
    throw new HttpError(403, "You do not own this exam");
  }

  return { user, exam };
}

/** Require EXAMINER who owns the question (or ADMIN). */
export async function requireQuestionOwner(questionId: string) {
  const user = await requireRole(["EXAMINER", "ADMIN"]);
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      ownerId: true,
      version: true,
    },
  });

  if (!question) {
    throw new HttpError(404, "Question not found");
  }

  if (user.role !== "ADMIN" && question.ownerId !== user.id) {
    throw new HttpError(403, "You do not own this question");
  }

  return { user, question };
}

/** Require CANDIDATE enrolled in the target exam. */
export async function requireEnrollment(examId: string) {
  const user = await requireRole(["CANDIDATE"]);
  const enrollment = await db.enrollment.findUnique({
    where: {
      examId_candidateId: {
        examId,
        candidateId: user.id,
      },
    },
  });

  if (!enrollment) {
    throw new HttpError(403, "You are not enrolled in this exam");
  }

  return { user, enrollment };
}

/** Require the user who owns the target attempt (candidate or sandbox examiner owner). */
export async function requireAttemptOwner(attemptId: string) {
  const user = await requireRole(["CANDIDATE", "EXAMINER", "ADMIN"]);
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      examId: true,
      candidateId: true,
      isSandbox: true,
      status: true,
      startedAt: true,
      deadlineAt: true,
    },
  });

  if (!attempt) {
    throw new HttpError(404, "Attempt not found");
  }

  if (attempt.candidateId !== user.id) {
    throw new HttpError(403, "You do not own this attempt");
  }

  return { user, attempt };
}

/**
 * Require either the candidate who owns the attempt, the examiner who owns
 * the parent exam, or an ADMIN. Used for PDF report downloads.
 */
export async function requireAttemptViewer(attemptId: string) {
  const user = await requireRole(["CANDIDATE", "EXAMINER", "ADMIN"]);
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      examId: true,
      candidateId: true,
      isSandbox: true,
      exam: { select: { ownerId: true } },
    },
  });

  if (!attempt || attempt.isSandbox) {
    throw new HttpError(404, "Attempt not found");
  }

  const isCandidateOwner = attempt.candidateId === user.id;
  const isExamOwner =
    user.role === "EXAMINER" && attempt.exam.ownerId === user.id;
  const isAdmin = user.role === "ADMIN";

  if (!isCandidateOwner && !isExamOwner && !isAdmin) {
    throw new HttpError(403, "Insufficient permissions to view this report");
  }

  return { user, attempt };
}

/** Convert thrown HttpError / unexpected errors into clean JSON responses. */
export function handleApiError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      { status: error.status },
    );
  }
  console.error("[API Error]", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}
