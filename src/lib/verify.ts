import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/permissions";

function getReportSecret(): string {
  const secret = process.env.REPORT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("REPORT_SECRET is missing or too short");
  }
  return secret;
}

export function signReportPayload(params: {
  tokenId: string;
  attemptId: string;
  scoreAtIssue: number;
  issuedAtIso: string;
}): string {
  const data = `${params.tokenId}:${params.attemptId}:${params.scoreAtIssue.toFixed(2)}:${params.issuedAtIso}`;
  return crypto
    .createHmac("sha256", getReportSecret())
    .update(data)
    .digest("hex");
}

function verifySignature(params: {
  tokenId: string;
  attemptId: string;
  scoreAtIssue: number;
  issuedAtIso: string;
  signature: string;
}): boolean {
  const expected = signReportPayload(params);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(params.signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function maskCandidateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "***";
  return parts
    .map((part) => {
      const first = part[0] ?? "*";
      return `${first}***`;
    })
    .join(" ");
}

export function formatScoreBand(score: number, totalMarks: number): string {
  if (totalMarks <= 0) return "0 to 10%";
  const pct = Math.max(0, Math.min(100, (score / totalMarks) * 100));
  if (pct >= 90) return "90 to 100%";
  const lower = Math.floor(pct / 10) * 10;
  return `${lower} to ${lower + 10}%`;
}

/**
 * Mark active ReportTokens for an attempt as superseded when a regrade or
 * question ruling changes the score.
 */
export async function supersedeReportTokens(
  tx: Prisma.TransactionClient,
  attemptId: string,
  replacementId = "SUPERSEDED",
) {
  await tx.reportToken.updateMany({
    where: {
      attemptId,
      supersededBy: null,
    },
    data: {
      supersededBy: replacementId,
    },
  });
}

/**
 * Issue or return the active ReportToken for a published, finalized real attempt.
 * If the attempt's score changed since the last token, marks older tokens superseded.
 */
export async function issueOrGetReportToken(attemptId: string) {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          totalMarks: true,
          resultsPublished: true,
        },
      },
      candidate: {
        select: { name: true },
      },
      questions: {
        orderBy: { position: "asc" },
        include: {
          grades: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      reportTokens: {
        where: { supersededBy: null },
        orderBy: { issuedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!attempt || attempt.isSandbox) {
    throw new HttpError(404, "Attempt not found");
  }
  if (attempt.status === "IN_PROGRESS") {
    throw new HttpError(409, "Attempt has not been submitted yet");
  }
  if (!attempt.exam.resultsPublished) {
    throw new HttpError(
      403,
      "Official reports are available after results are published",
    );
  }

  let currentScore = 0;
  for (const aq of attempt.questions) {
    if (aq.grades[0]) {
      currentScore += aq.grades[0].score;
    }
  }
  currentScore = Math.round(currentScore * 100) / 100;

  const existing = attempt.reportTokens[0];
  if (existing && Math.abs(existing.scoreAtIssue - currentScore) < 0.001) {
    return {
      token: existing,
      attempt,
      currentScore,
    };
  }

  const newTokenId = crypto.randomBytes(16).toString("hex");
  const issuedAt = new Date();
  const signature = signReportPayload({
    tokenId: newTokenId,
    attemptId: attempt.id,
    scoreAtIssue: currentScore,
    issuedAtIso: issuedAt.toISOString(),
  });

  const created = await db.$transaction(async (tx) => {
    await tx.reportToken.updateMany({
      where: { attemptId: attempt.id, supersededBy: null },
      data: { supersededBy: newTokenId },
    });

    return tx.reportToken.create({
      data: {
        id: newTokenId,
        attemptId: attempt.id,
        scoreAtIssue: currentScore,
        issuedAt,
        signature,
        supersededBy: null,
      },
    });
  });

  return {
    token: created,
    attempt,
    currentScore,
  };
}

export type VerifyStatus = "VALID" | "SUPERSEDED" | "NOT_FOUND";

export interface PublicVerificationPayload {
  status: VerifyStatus;
  examTitle?: string;
  issuedAt?: string;
  scoreBand?: string;
  maskedName?: string;
}

/**
 * Public minimal verification lookup.
 * Strictly returns validity, exam title, issue date, score band, and masked name.
 * Never selects or exposes email, user ID, or raw attempt ID.
 */
export async function verifyReportToken(
  tokenId: string,
): Promise<PublicVerificationPayload> {
  if (!/^[a-f0-9]{16,64}$/i.test(tokenId.trim())) {
    return { status: "NOT_FOUND" };
  }

  const record = await db.reportToken.findUnique({
    where: { id: tokenId.trim() },
    select: {
      id: true,
      attemptId: true,
      scoreAtIssue: true,
      issuedAt: true,
      signature: true,
      supersededBy: true,
      attempt: {
        select: {
          isSandbox: true,
          exam: {
            select: {
              title: true,
              totalMarks: true,
            },
          },
          candidate: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!record || record.attempt.isSandbox) {
    return { status: "NOT_FOUND" };
  }

  const validSig = verifySignature({
    tokenId: record.id,
    attemptId: record.attemptId,
    scoreAtIssue: record.scoreAtIssue,
    issuedAtIso: record.issuedAt.toISOString(),
    signature: record.signature,
  });

  if (!validSig) {
    return { status: "NOT_FOUND" };
  }

  return {
    status: record.supersededBy ? "SUPERSEDED" : "VALID",
    examTitle: record.attempt.exam.title,
    issuedAt: record.issuedAt.toISOString(),
    scoreBand: formatScoreBand(
      record.scoreAtIssue,
      record.attempt.exam.totalMarks,
    ),
    maskedName: maskCandidateName(record.attempt.candidate.name),
  };
}
