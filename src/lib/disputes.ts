import type {
  DisputeCategory,
  DisputeStatus,
  RulingType,
} from "@prisma/client";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  gradeQuestion,
  parseSelectedOptionIds,
  parseSnapshotOptions,
  type SnapshotOption,
} from "@/lib/grading";
import { HttpError } from "@/lib/permissions";
import { realAttemptsWhere } from "@/lib/results";
import { supersedeReportTokens } from "@/lib/verify";

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface EvidencePack {
  attemptId: string;
  attemptStatus: string;
  startedAt: string;
  submittedAt: string | null;
  deadlineAt: string;
  attemptTotalScore: number;
  question: {
    attemptQuestionId: string;
    sourceQuestionId: string;
    position: number;
    type: string;
    marks: number;
    text: string;
    options: SnapshotOption[];
  };
  answer: {
    selectedOptionIds: string[];
    writtenText: string | null;
    revision: number;
    savedAt: string | null;
  };
  awardedScore: number | null;
  gradeHistory: Array<{
    id: string;
    score: number;
    reason: string | null;
    rulingId: string | null;
    createdAt: string;
  }>;
  incidents: Array<{
    id: string;
    type: string;
    detail: string | null;
    at: string;
  }>;
}

export interface CandidateDisputeView {
  id: string;
  attemptQuestionId: string;
  questionPosition: number;
  category: DisputeCategory;
  message: string;
  status: DisputeStatus;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  evidence: EvidencePack;
}

export interface ExaminerDisputeItem {
  id: string;
  attemptQuestionId: string;
  sourceQuestionId: string;
  questionPosition: number;
  category: DisputeCategory;
  message: string;
  status: DisputeStatus;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  resolverName: string | null;
  evidence: EvidencePack;
}

export interface ExamRulingItem {
  id: string;
  sourceQuestionId: string;
  questionText: string;
  type: RulingType;
  acceptedOptionIds: string[];
  reason: string;
  createdByName: string;
  createdAt: string;
}

export interface ExamRulingQuestionTarget {
  sourceQuestionId: string;
  positionHint: number;
  type: string;
  marks: number;
  text: string;
  options: SnapshotOption[];
  affectedAttemptCount: number;
}

export interface RegradeDiffRow {
  attemptId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  oldQuestionScore: number;
  newQuestionScore: number;
  oldTotalScore: number;
  newTotalScore: number;
  delta: number;
}

function buildEvidencePack(params: {
  attempt: {
    id: string;
    status: string;
    startedAt: Date;
    submittedAt: Date | null;
    deadlineAt: Date;
    totalScore: number | null;
    incidents: Array<{
      id: string;
      type: string;
      detail: string | null;
      at: Date;
    }>;
  };
  aq: {
    id: string;
    sourceQuestionId: string;
    position: number;
    typeSnapshot: string;
    marksSnapshot: number;
    textSnapshot: string;
    optionsSnapshot: unknown;
    answer: {
      selectedOptionIds: unknown;
      writtenText: string | null;
      revision: number;
      savedAt: Date;
    } | null;
    grades: Array<{
      id: string;
      score: number;
      reason: string | null;
      rulingId: string | null;
      createdAt: Date;
    }>;
  };
}): EvidencePack {
  const { attempt, aq } = params;
  const latest = aq.grades[0] ?? null;

  return {
    attemptId: attempt.id,
    attemptStatus: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    deadlineAt: attempt.deadlineAt.toISOString(),
    attemptTotalScore: roundScore(attempt.totalScore ?? 0),
    question: {
      attemptQuestionId: aq.id,
      sourceQuestionId: aq.sourceQuestionId,
      position: aq.position,
      type: aq.typeSnapshot,
      marks: aq.marksSnapshot,
      text: aq.textSnapshot,
      options: parseSnapshotOptions(aq.optionsSnapshot),
    },
    answer: {
      selectedOptionIds: aq.answer
        ? parseSelectedOptionIds(aq.answer.selectedOptionIds)
        : [],
      writtenText: aq.answer?.writtenText ?? null,
      revision: aq.answer?.revision ?? 0,
      savedAt: aq.answer?.savedAt.toISOString() ?? null,
    },
    awardedScore: latest ? latest.score : null,
    gradeHistory: aq.grades.map((g) => ({
      id: g.id,
      score: g.score,
      reason: g.reason,
      rulingId: g.rulingId,
      createdAt: g.createdAt.toISOString(),
    })),
    incidents: attempt.incidents.map((inc) => ({
      id: inc.id,
      type: inc.type,
      detail: inc.detail,
      at: inc.at.toISOString(),
    })),
  };
}

/** Candidate creates a dispute on a published real attempt question. */
export async function createCandidateDispute(params: {
  attemptId: string;
  candidateId: string;
  attemptQuestionId: string;
  category: DisputeCategory;
  message: string;
}) {
  const attempt = await db.attempt.findUnique({
    where: { id: params.attemptId },
    include: {
      exam: { select: { id: true, resultsPublished: true } },
    },
  });

  if (!attempt || attempt.isSandbox) {
    throw new HttpError(404, "Attempt not found");
  }
  if (attempt.candidateId !== params.candidateId) {
    throw new HttpError(403, "You do not own this attempt");
  }
  if (!attempt.exam.resultsPublished) {
    throw new HttpError(
      409,
      "Disputes can only be filed after results are published",
    );
  }
  if (attempt.status === "IN_PROGRESS") {
    throw new HttpError(409, "Cannot dispute an attempt still in progress");
  }

  const aq = await db.attemptQuestion.findFirst({
    where: { id: params.attemptQuestionId, attemptId: attempt.id },
    select: { id: true, position: true, sourceQuestionId: true },
  });
  if (!aq) {
    throw new HttpError(404, "Question not found on this attempt");
  }

  const existingOpen = await db.dispute.findFirst({
    where: {
      attemptQuestionId: aq.id,
      candidateId: params.candidateId,
      status: { in: ["OPEN", "UNDER_REVIEW"] },
    },
    select: { id: true },
  });
  if (existingOpen) {
    throw new HttpError(
      409,
      "An active dispute is already open for this question",
    );
  }

  const created = await db.$transaction(async (tx) => {
    const dispute = await tx.dispute.create({
      data: {
        attemptQuestionId: aq.id,
        candidateId: params.candidateId,
        category: params.category,
        message: params.message.trim(),
        status: "OPEN",
      },
    });

    await appendAuditLog(tx, {
      actorId: params.candidateId,
      action: "DISPUTE_FILED",
      entity: "Dispute",
      entityId: dispute.id,
      payload: {
        examId: attempt.exam.id,
        attemptId: attempt.id,
        attemptQuestionId: aq.id,
        sourceQuestionId: aq.sourceQuestionId,
        questionPosition: aq.position,
        category: params.category,
      },
    });

    return dispute;
  });

  return created;
}

/** Return the owning candidate's disputes + evidence packs for an attempt. */
export async function getCandidateAttemptDisputes(
  attemptId: string,
  candidateId: string,
): Promise<CandidateDisputeView[]> {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: { select: { resultsPublished: true } },
      incidents: { orderBy: { at: "asc" } },
    },
  });

  if (!attempt || attempt.isSandbox) {
    throw new HttpError(404, "Attempt not found");
  }
  if (attempt.candidateId !== candidateId) {
    throw new HttpError(403, "You do not own this attempt");
  }
  if (!attempt.exam.resultsPublished) {
    return [];
  }

  const disputes = await db.dispute.findMany({
    where: {
      candidateId,
      attemptQuestion: { attemptId },
    },
    orderBy: { createdAt: "desc" },
    include: {
      attemptQuestion: {
        include: {
          answer: true,
          grades: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  return disputes.map((d) => ({
    id: d.id,
    attemptQuestionId: d.attemptQuestionId,
    questionPosition: d.attemptQuestion.position,
    category: d.category,
    message: d.message,
    status: d.status,
    resolution: d.resolution,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    evidence: buildEvidencePack({
      attempt,
      aq: d.attemptQuestion,
    }),
  }));
}

/** Examiner/Admin payload: dispute queue, active rulings, and targetable questions. */
export async function getExaminerDisputesAndRulings(examId: string): Promise<{
  disputes: ExaminerDisputeItem[];
  rulings: ExamRulingItem[];
  questionTargets: ExamRulingQuestionTarget[];
}> {
  const [disputes, rulings, attemptQuestions, examQuestions] = await Promise.all([
    db.dispute.findMany({
      where: {
        attemptQuestion: {
          attempt: realAttemptsWhere({ examId }),
        },
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        resolver: { select: { name: true } },
        attemptQuestion: {
          include: {
            attempt: {
              include: {
                incidents: { orderBy: { at: "asc" } },
              },
            },
            answer: true,
            grades: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    }),
    db.questionRuling.findMany({
      where: { examId },
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { name: true } },
      },
    }),
    db.attemptQuestion.findMany({
      where: {
        attempt: realAttemptsWhere({
          examId,
          status: { not: "IN_PROGRESS" },
        }),
      },
      select: {
        sourceQuestionId: true,
        position: true,
        typeSnapshot: true,
        marksSnapshot: true,
        textSnapshot: true,
        optionsSnapshot: true,
      },
    }),
    db.examQuestion.findMany({
      where: { examId },
      orderBy: { order: "asc" },
      include: {
        question: {
          include: {
            options: { orderBy: { order: "asc" } },
          },
        },
      },
    }),
  ]);

  const targetMap = new Map<string, ExamRulingQuestionTarget>();

  for (const aq of attemptQuestions) {
    const existing = targetMap.get(aq.sourceQuestionId);
    if (existing) {
      existing.affectedAttemptCount += 1;
    } else {
      targetMap.set(aq.sourceQuestionId, {
        sourceQuestionId: aq.sourceQuestionId,
        positionHint: aq.position,
        type: aq.typeSnapshot,
        marks: aq.marksSnapshot,
        text: aq.textSnapshot,
        options: parseSnapshotOptions(aq.optionsSnapshot),
        affectedAttemptCount: 1,
      });
    }
  }

  for (const eq of examQuestions) {
    if (!targetMap.has(eq.questionId)) {
      targetMap.set(eq.questionId, {
        sourceQuestionId: eq.questionId,
        positionHint: eq.order + 1,
        type: eq.question.type,
        marks: eq.marksOverride ?? eq.question.marks,
        text: eq.question.text,
        options: eq.question.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          isCorrect: opt.isCorrect,
        })),
        affectedAttemptCount: 0,
      });
    }
  }

  const questionTargets = Array.from(targetMap.values()).sort(
    (a, b) => a.positionHint - b.positionHint,
  );
  const textBySource = new Map(
    questionTargets.map((q) => [q.sourceQuestionId, q.text]),
  );

  // Put OPEN / UNDER_REVIEW first while preserving recency within priority
  const statusWeight: Record<DisputeStatus, number> = {
    OPEN: 0,
    UNDER_REVIEW: 1,
    UPHELD: 2,
    REJECTED: 3,
  };

  const sortedDisputes = [...disputes].sort(
    (a, b) =>
      statusWeight[a.status] - statusWeight[b.status] ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return {
    disputes: sortedDisputes.map((d) => ({
      id: d.id,
      attemptQuestionId: d.attemptQuestionId,
      sourceQuestionId: d.attemptQuestion.sourceQuestionId,
      questionPosition: d.attemptQuestion.position,
      category: d.category,
      message: d.message,
      status: d.status,
      resolution: d.resolution,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      candidate: d.candidate,
      resolverName: d.resolver?.name ?? null,
      evidence: buildEvidencePack({
        attempt: d.attemptQuestion.attempt,
        aq: d.attemptQuestion,
      }),
    })),
    rulings: rulings.map((r) => {
      const detail =
        r.detail && typeof r.detail === "object"
          ? (r.detail as Record<string, unknown>)
          : {};
      const acceptedOptionIds = Array.isArray(detail.acceptedOptionIds)
        ? detail.acceptedOptionIds.filter(
            (id): id is string => typeof id === "string",
          )
        : [];

      return {
        id: r.id,
        sourceQuestionId: r.sourceQuestionId,
        questionText:
          textBySource.get(r.sourceQuestionId) ?? "Snapshot Question",
        type: r.type,
        acceptedOptionIds,
        reason: r.reason,
        createdByName: r.creator.name,
        createdAt: r.createdAt.toISOString(),
      };
    }),
    questionTargets,
  };
}

/** Examiner marks UNDER_REVIEW, REJECTS, or UPHOLDS (single candidate regrade). */
export async function resolveExaminerDispute(params: {
  examId: string;
  examinerId: string;
  disputeId: string;
  decision: "UNDER_REVIEW" | "REJECT" | "UPHOLD";
  resolution?: string;
  newScore?: number;
}) {
  const dispute = await db.dispute.findUnique({
    where: { id: params.disputeId },
    include: {
      attemptQuestion: {
        include: {
          attempt: {
            select: {
              id: true,
              examId: true,
              isSandbox: true,
              status: true,
              totalScore: true,
            },
          },
          grades: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (
    !dispute ||
    dispute.attemptQuestion.attempt.examId !== params.examId ||
    dispute.attemptQuestion.attempt.isSandbox
  ) {
    throw new HttpError(404, "Dispute not found for this exam");
  }

  const aq = dispute.attemptQuestion;
  const note = params.resolution?.trim() ?? "";

  if (params.decision === "UPHOLD") {
    if (params.newScore === undefined) {
      throw new HttpError(400, "Updated score is required to uphold dispute");
    }
    if (params.newScore < 0 || params.newScore > aq.marksSnapshot) {
      throw new HttpError(
        400,
        `Score must be between 0 and ${aq.marksSnapshot}`,
      );
    }
  }

  await db.$transaction(async (tx) => {
    if (params.decision === "UNDER_REVIEW") {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "UNDER_REVIEW",
          ...(note ? { resolution: note } : {}),
          resolvedBy: params.examinerId,
        },
      });

      await appendAuditLog(tx, {
        actorId: params.examinerId,
        action: "DISPUTE_UNDER_REVIEW",
        entity: "Dispute",
        entityId: dispute.id,
        payload: {
          examId: params.examId,
          attemptId: aq.attempt.id,
          attemptQuestionId: aq.id,
          resolution: note || null,
        },
      });
      return;
    }

    if (params.decision === "REJECT") {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "REJECTED",
          resolution: note,
          resolvedBy: params.examinerId,
        },
      });

      await appendAuditLog(tx, {
        actorId: params.examinerId,
        action: "DISPUTE_REJECTED",
        entity: "Dispute",
        entityId: dispute.id,
        payload: {
          examId: params.examId,
          attemptId: aq.attempt.id,
          attemptQuestionId: aq.id,
          resolution: note,
        },
      });
      return;
    }

    // UPHOLD: insert append-only Grade row + recalculate attempt total + supersede tokens
    const oldQuestionScore = aq.grades[0]?.score ?? 0;
    const roundedNewScore = roundScore(params.newScore!);

    await tx.grade.create({
      data: {
        attemptQuestionId: aq.id,
        score: roundedNewScore,
        gradedBy: params.examinerId,
        reason: `Dispute upheld: ${note}`,
      },
    });

    const siblings = await tx.attemptQuestion.findMany({
      where: { attemptId: aq.attempt.id },
      include: {
        grades: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    let total = 0;
    let pendingWritten = 0;
    for (const item of siblings) {
      const latest = item.grades[0];
      if (latest) {
        total += latest.score;
      } else if (item.typeSnapshot === "WRITTEN") {
        pendingWritten += 1;
      }
    }

    const roundedTotal = roundScore(total);

    await tx.attempt.update({
      where: { id: aq.attempt.id },
      data: {
        totalScore: roundedTotal,
        ...(pendingWritten === 0 ? { status: "GRADED" } : {}),
      },
    });

    await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: "UPHELD",
        resolution: note,
        resolvedBy: params.examinerId,
      },
    });

    await supersedeReportTokens(tx, aq.attempt.id);

    await appendAuditLog(tx, {
      actorId: params.examinerId,
      action: "DISPUTE_UPHELD_REGRADE",
      entity: "Dispute",
      entityId: dispute.id,
      payload: {
        examId: params.examId,
        attemptId: aq.attempt.id,
        attemptQuestionId: aq.id,
        oldQuestionScore,
        newQuestionScore: roundedNewScore,
        oldTotalScore: roundScore(aq.attempt.totalScore ?? 0),
        newTotalScore: roundedTotal,
        resolution: note,
      },
    });
  }, { maxWait: 15000, timeout: 30000 });

  return getExaminerDisputesAndRulings(params.examId);
}

/**
 * Create a question-level ruling (ACCEPT_ALTERNATE or VOID_QUESTION),
 * recompute every affected real attempt from frozen snapshots + rulings in a
 * single transaction, write append-only Grade rows, supersede stale report
 * tokens, audit-log every change, and return a before/after diff table.
 */
export async function applyQuestionRuling(params: {
  examId: string;
  examinerId: string;
  sourceQuestionId: string;
  type: RulingType;
  acceptedOptionIds: string[];
  reason: string;
  disputeId?: string;
}): Promise<{
  rulingId: string;
  regradedCount: number;
  changedCount: number;
  diffs: RegradeDiffRow[];
  state: Awaited<ReturnType<typeof getExaminerDisputesAndRulings>>;
}> {
  const exam = await db.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, negativeMarking: true },
  });
  if (!exam) {
    throw new HttpError(404, "Exam not found");
  }

  const trimmedReason = params.reason.trim();
  const uniqueOptionIds = Array.from(new Set(params.acceptedOptionIds));

  const txResult = await db.$transaction(async (tx) => {
    const existingRulings = await tx.questionRuling.findMany({
      where: {
        examId: params.examId,
        sourceQuestionId: params.sourceQuestionId,
      },
      orderBy: { createdAt: "asc" },
    });

    const newRuling = await tx.questionRuling.create({
      data: {
        examId: params.examId,
        sourceQuestionId: params.sourceQuestionId,
        type: params.type,
        detail:
          params.type === "ACCEPT_ALTERNATE"
            ? { acceptedOptionIds: uniqueOptionIds }
            : {},
        reason: trimmedReason,
        createdBy: params.examinerId,
      },
    });

    const allRulings = [...existingRulings, newRuling];

    const affectedAttemptQuestions = await tx.attemptQuestion.findMany({
      where: {
        sourceQuestionId: params.sourceQuestionId,
        attempt: realAttemptsWhere({
          examId: params.examId,
          status: { not: "IN_PROGRESS" },
        }),
      },
      include: {
        answer: true,
        grades: { orderBy: { createdAt: "desc" } },
        attempt: {
          include: {
            candidate: { select: { id: true, name: true, email: true } },
            questions: {
              include: {
                grades: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            },
          },
        },
      },
      orderBy: [{ attempt: { candidate: { name: "asc" } } }],
    });

    const diffs: RegradeDiffRow[] = [];
    const changedAttemptQuestionIds: string[] = [];
    const changedAttemptIds: string[] = [];
    const gradesToCreate: Array<{
      attemptQuestionId: string;
      score: number;
      gradedBy: string;
      rulingId: string;
      reason: string;
    }> = [];
    const attemptUpdates: Array<{
      attemptId: string;
      totalScore: number;
      markGraded: boolean;
    }> = [];

    const rulingLabel =
      params.type === "VOID_QUESTION" ? "Void question" : "Accept alternate";

    for (const aq of affectedAttemptQuestions) {
      const oldQuestionScore = roundScore(aq.grades[0]?.score ?? 0);

      let oldComputedTotal = 0;
      let otherQuestionsTotal = 0;
      let otherPendingWritten = 0;

      for (const sibling of aq.attempt.questions) {
        const latest = sibling.grades[0];
        if (latest) {
          oldComputedTotal += latest.score;
          if (sibling.id !== aq.id) {
            otherQuestionsTotal += latest.score;
          }
        } else if (sibling.id !== aq.id && sibling.typeSnapshot === "WRITTEN") {
          otherPendingWritten += 1;
        }
      }

      const oldTotalScore = roundScore(
        aq.attempt.totalScore ?? oldComputedTotal,
      );

      const graded = gradeQuestion(
        {
          sourceQuestionId: aq.sourceQuestionId,
          typeSnapshot: aq.typeSnapshot,
          marksSnapshot: aq.marksSnapshot,
          multiModeSnapshot: aq.multiModeSnapshot,
          optionsSnapshot: parseSnapshotOptions(aq.optionsSnapshot),
        },
        aq.answer
          ? {
              selectedOptionIds: parseSelectedOptionIds(
                aq.answer.selectedOptionIds,
              ),
              writtenText: aq.answer.writtenText,
            }
          : null,
        allRulings.map((r) => ({
          id: r.id,
          sourceQuestionId: r.sourceQuestionId,
          type: r.type,
          detail: r.detail,
        })),
        exam.negativeMarking,
      );

      const newQuestionScore =
        graded.score !== null ? roundScore(graded.score) : oldQuestionScore;
      const newTotalScore = roundScore(otherQuestionsTotal + newQuestionScore);
      const delta = roundScore(newTotalScore - oldTotalScore);

      gradesToCreate.push({
        attemptQuestionId: aq.id,
        score: newQuestionScore,
        gradedBy: params.examinerId,
        rulingId: newRuling.id,
        reason: `Ruling (${rulingLabel}): ${trimmedReason}`,
      });

      const pendingWritten =
        otherPendingWritten +
        (graded.pending && aq.typeSnapshot === "WRITTEN" ? 1 : 0);

      attemptUpdates.push({
        attemptId: aq.attempt.id,
        totalScore: newTotalScore,
        markGraded: pendingWritten === 0,
      });

      if (Math.abs(delta) > 0.001) {
        changedAttemptQuestionIds.push(aq.id);
        changedAttemptIds.push(aq.attempt.id);
      }

      diffs.push({
        attemptId: aq.attempt.id,
        candidateId: aq.attempt.candidate.id,
        candidateName: aq.attempt.candidate.name,
        candidateEmail: aq.attempt.candidate.email,
        oldQuestionScore,
        newQuestionScore,
        oldTotalScore,
        newTotalScore,
        delta,
      });
    }

    if (gradesToCreate.length > 0) {
      await tx.grade.createMany({ data: gradesToCreate });
    }

    for (const upd of attemptUpdates) {
      await tx.attempt.update({
        where: { id: upd.attemptId },
        data: {
          totalScore: upd.totalScore,
          ...(upd.markGraded ? { status: "GRADED" } : {}),
        },
      });
    }

    if (changedAttemptIds.length > 0) {
      await tx.reportToken.updateMany({
        where: {
          attemptId: { in: changedAttemptIds },
          supersededBy: null,
        },
        data: { supersededBy: "SUPERSEDED" },
      });
    }

    if (params.disputeId) {
      await tx.dispute.updateMany({
        where: {
          id: params.disputeId,
          attemptQuestion: {
            attempt: { examId: params.examId },
          },
        },
        data: {
          status: "UPHELD",
          resolution: `Question ruling applied: ${trimmedReason}`,
          resolvedBy: params.examinerId,
        },
      });
    }

    if (changedAttemptQuestionIds.length > 0) {
      await tx.dispute.updateMany({
        where: {
          attemptQuestionId: { in: changedAttemptQuestionIds },
          status: { in: ["OPEN", "UNDER_REVIEW"] },
        },
        data: {
          status: "UPHELD",
          resolution: `Question ruling applied: ${trimmedReason}`,
          resolvedBy: params.examinerId,
        },
      });
    }

    const changedDiffs = diffs.filter((d) => Math.abs(d.delta) > 0.001);

    await appendAuditLog(tx, {
      actorId: params.examinerId,
      action: "QUESTION_RULING_APPLIED",
      entity: "QuestionRuling",
      entityId: newRuling.id,
      payload: {
        examId: params.examId,
        sourceQuestionId: params.sourceQuestionId,
        type: params.type,
        acceptedOptionIds: uniqueOptionIds,
        reason: trimmedReason,
        regradedCount: diffs.length,
        changedCount: changedDiffs.length,
        changes: changedDiffs.map((d) => ({
          attemptId: d.attemptId,
          candidateId: d.candidateId,
          oldScore: d.oldTotalScore,
          newScore: d.newTotalScore,
          delta: d.delta,
        })),
      },
    });

    diffs.sort(
      (a, b) =>
        Math.abs(b.delta) - Math.abs(a.delta) ||
        a.candidateName.localeCompare(b.candidateName),
    );

    return {
      rulingId: newRuling.id,
      regradedCount: diffs.length,
      changedCount: changedDiffs.length,
      diffs,
    };
  }, { maxWait: 15000, timeout: 45000 });

  const state = await getExaminerDisputesAndRulings(params.examId);
  return { ...txResult, state };
}
