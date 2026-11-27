import crypto from "node:crypto";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { HttpError } from "@/lib/permissions";
import {
  parseCandidateImportCsv,
  type ImportFailure,
} from "@/lib/importer";

export interface EnrolledCandidateItem {
  enrollmentId: string;
  candidateId: string;
  name: string;
  email: string;
  isActive: boolean;
  enrolledAt: string;
  attemptStatus: string | null;
}

export interface AvailableCandidateItem {
  id: string;
  name: string;
  email: string;
}

export interface GeneratedCredential {
  name: string;
  email: string;
  oneTimePassword: string;
}

function generateOneTimePassword(): string {
  // Unambiguous alphanumeric token (12 chars)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function listExamEnrollments(examId: string): Promise<{
  enrolled: EnrolledCandidateItem[];
  availableCandidates: AvailableCandidateItem[];
}> {
  const [enrollments, attempts, allActiveCandidates] = await Promise.all([
    db.enrollment.findMany({
      where: { examId },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.attempt.findMany({
      where: { examId, isSandbox: false },
      select: { candidateId: true, status: true },
    }),
    db.user.findMany({
      where: { role: "CANDIDATE", isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const attemptByCandidate = new Map(
    attempts.map((a) => [a.candidateId, a.status]),
  );
  const enrolledIds = new Set(enrollments.map((e) => e.candidateId));

  return {
    enrolled: enrollments.map((e) => ({
      enrollmentId: e.id,
      candidateId: e.candidateId,
      name: e.candidate.name,
      email: e.candidate.email,
      isActive: e.candidate.isActive,
      enrolledAt: e.createdAt.toISOString(),
      attemptStatus: attemptByCandidate.get(e.candidateId) ?? null,
    })),
    availableCandidates: allActiveCandidates.filter(
      (c) => !enrolledIds.has(c.id),
    ),
  };
}

export async function enrollCandidatesByIds(
  examId: string,
  candidateIds: string[],
) {
  const uniqueIds = Array.from(new Set(candidateIds));
  const validUsers = await db.user.findMany({
    where: {
      id: { in: uniqueIds },
      role: "CANDIDATE",
      isActive: true,
    },
    select: { id: true },
  });

  if (validUsers.length !== uniqueIds.length) {
    throw new HttpError(
      400,
      "One or more selected users are not active candidate accounts",
    );
  }

  await db.enrollment.createMany({
    data: uniqueIds.map((candidateId) => ({ examId, candidateId })),
    skipDuplicates: true,
  });

  return listExamEnrollments(examId);
}

export async function removeEnrollment(examId: string, candidateId: string) {
  const startedAttempt = await db.attempt.findFirst({
    where: { examId, candidateId, isSandbox: false },
    select: { id: true },
  });

  if (startedAttempt) {
    throw new HttpError(
      409,
      "Cannot unenroll a candidate who has already started an attempt",
    );
  }

  await db.enrollment.deleteMany({
    where: { examId, candidateId },
  });

  return listExamEnrollments(examId);
}

/**
 * Import candidates from CSV (`name,email`), create missing CANDIDATE accounts
 * with one-time passwords, and enroll everyone in the exam.
 */
export async function importAndEnrollCandidates(
  examId: string,
  csvContent: string,
) {
  const parsed = parseCandidateImportCsv(csvContent);
  const failed: ImportFailure[] = [...parsed.failed];
  const createdCredentials: GeneratedCredential[] = [];

  if (parsed.validRows.length === 0) {
    const state = await listExamEnrollments(examId);
    return {
      createdAccounts: 0,
      enrolledCount: 0,
      createdCredentials,
      failed,
      ...state,
    };
  }

  // Track original row numbers for each valid email for clean error reporting
  const csvLookup = Papa.parse<Record<string, unknown>>(csvContent.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ""),
  });
  const rowByEmail = new Map<string, number>();
  csvLookup.data.forEach((raw, idx) => {
    const email = String(raw.email ?? "").trim().toLowerCase();
    if (email && !rowByEmail.has(email)) {
      rowByEmail.set(email, idx + 2);
    }
  });

  const emails = parsed.validRows.map((r) => r.email);
  const [existingUsers, existingEnrollments] = await Promise.all([
    db.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, role: true, isActive: true },
    }),
    db.enrollment.findMany({
      where: {
        examId,
        candidate: { email: { in: emails } },
      },
      include: {
        candidate: { select: { email: true } },
      },
    }),
  ]);

  const userByEmail = new Map(existingUsers.map((u) => [u.email, u]));
  const alreadyEnrolledEmails = new Set(
    existingEnrollments.map((e) => e.candidate.email),
  );

  const existingCandidateIdsToEnroll: string[] = [];
  const missingCandidatesToCreate: Array<{
    name: string;
    email: string;
    oneTimePassword: string;
    passwordHash: string;
  }> = [];

  for (const row of parsed.validRows) {
    const rowNum = rowByEmail.get(row.email) ?? 0;

    if (alreadyEnrolledEmails.has(row.email)) {
      failed.push({
        row: rowNum,
        field: "email",
        message: "Candidate is already enrolled in this exam",
      });
      continue;
    }

    const existing = userByEmail.get(row.email);
    if (existing) {
      if (existing.role !== "CANDIDATE") {
        failed.push({
          row: rowNum,
          field: "email",
          message: `Account already exists with ${existing.role} role`,
        });
        continue;
      }
      if (!existing.isActive) {
        failed.push({
          row: rowNum,
          field: "email",
          message: "Existing candidate account is deactivated",
        });
        continue;
      }
      existingCandidateIdsToEnroll.push(existing.id);
      continue;
    }

    const oneTimePassword = generateOneTimePassword();
    const passwordHash = await hashPassword(oneTimePassword);
    missingCandidatesToCreate.push({
      name: row.name,
      email: row.email,
      oneTimePassword,
      passwordHash,
    });
  }

  await db.$transaction(async (tx) => {
    const newlyCreatedIds: string[] = [];

    for (const candidate of missingCandidatesToCreate) {
      const created = await tx.user.create({
        data: {
          name: candidate.name,
          email: candidate.email,
          passwordHash: candidate.passwordHash,
          role: "CANDIDATE",
          isActive: true,
        },
        select: { id: true },
      });
      newlyCreatedIds.push(created.id);
      createdCredentials.push({
        name: candidate.name,
        email: candidate.email,
        oneTimePassword: candidate.oneTimePassword,
      });
    }

    const allIdsToEnroll = [
      ...existingCandidateIdsToEnroll,
      ...newlyCreatedIds,
    ];
    if (allIdsToEnroll.length > 0) {
      await tx.enrollment.createMany({
        data: allIdsToEnroll.map((candidateId) => ({ examId, candidateId })),
        skipDuplicates: true,
      });
    }
  });

  const state = await listExamEnrollments(examId);

  return {
    createdAccounts: createdCredentials.length,
    enrolledCount:
      existingCandidateIdsToEnroll.length + createdCredentials.length,
    createdCredentials,
    failed,
    ...state,
  };
}
