import { db } from "@/lib/db";
import { finalizeIfExpired, startOrResumeAttempt } from "@/lib/attempts";
import { HttpError } from "@/lib/permissions";

/**
 * Start or resume an owner's sandbox attempt.
 * Skips enrollment and time-window checks cleanly while using the exact
 * snapshot-frozen attempt engine (`isSandbox = true`, `realKey = null`).
 */
export async function startOrResumeSandboxAttempt(
  examId: string,
  ownerUserId: string,
) {
  const questionCount = await db.examQuestion.count({ where: { examId } });
  if (questionCount === 0) {
    throw new HttpError(
      400,
      "Assign at least one question before launching Sandbox Preview",
    );
  }

  const existingInProgress = await db.attempt.findFirst({
    where: {
      examId,
      candidateId: ownerUserId,
      isSandbox: true,
      status: "IN_PROGRESS",
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  if (existingInProgress) {
    const checked = await finalizeIfExpired(existingInProgress.id, false);
    if (checked && checked.status === "IN_PROGRESS") {
      return {
        attempt: {
          id: checked.id,
          examId,
          status: checked.status,
          isSandbox: true,
          deadlineAt: checked.deadlineAt.toISOString(),
        },
        resumed: true,
      };
    }
  }

  const started = await startOrResumeAttempt({
    candidateId: ownerUserId,
    examId,
    isSandbox: true,
  });

  return {
    ...started,
    resumed: false,
  };
}

/** Delete all sandbox attempts for this owner & exam so preview can restart cleanly. */
export async function resetSandboxAttempts(
  examId: string,
  ownerUserId: string,
) {
  const deleted = await db.attempt.deleteMany({
    where: {
      examId,
      candidateId: ownerUserId,
      isSandbox: true,
    },
  });

  return { ok: true, deletedCount: deleted.count };
}
