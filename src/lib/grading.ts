import type {
  MultiMode,
  Prisma,
  QuestionType,
  RulingType,
} from "@prisma/client";

export interface SnapshotOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionSnapshotInput {
  sourceQuestionId: string;
  typeSnapshot: QuestionType;
  marksSnapshot: number;
  multiModeSnapshot: MultiMode;
  optionsSnapshot: SnapshotOption[] | null;
}

export interface AnswerSnapshotInput {
  selectedOptionIds: string[];
  writtenText: string | null;
}

export interface RulingInput {
  id?: string;
  sourceQuestionId: string;
  type: RulingType;
  detail: unknown;
}

export interface GradeQuestionResult {
  score: number | null;
  pending: boolean;
  rulingId: string | null;
  reason: string;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseSnapshotOptions(raw: unknown): SnapshotOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      id: String(item.id ?? ""),
      text: String(item.text ?? ""),
      isCorrect: Boolean(item.isCorrect),
    }))
    .filter((item) => item.id.length > 0);
}

export function parseSelectedOptionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(raw.filter((item): item is string => typeof item === "string")),
  );
}

function extractAcceptedAlternates(detail: unknown): string[] {
  if (!detail || typeof detail !== "object") return [];
  const obj = detail as Record<string, unknown>;
  if (!Array.isArray(obj.acceptedOptionIds)) return [];
  return obj.acceptedOptionIds.filter(
    (id): id is string => typeof id === "string",
  );
}

/**
 * Pure, unit-testable grader working exclusively from frozen snapshots and
 * ruling overlays (never the live question bank).
 */
export function gradeQuestion(
  snapshot: QuestionSnapshotInput,
  answer: AnswerSnapshotInput | null,
  rulings: RulingInput[] = [],
  negativeMarking = 0,
): GradeQuestionResult {
  const matchingRulings = rulings.filter(
    (r) => r.sourceQuestionId === snapshot.sourceQuestionId,
  );

  const voidRuling = matchingRulings.find((r) => r.type === "VOID_QUESTION");
  if (voidRuling) {
    return {
      score: snapshot.marksSnapshot,
      pending: false,
      rulingId: voidRuling.id ?? null,
      reason: "Awarded full marks (question voided by ruling)",
    };
  }

  if (snapshot.typeSnapshot === "WRITTEN") {
    return {
      score: null,
      pending: true,
      rulingId: null,
      reason: "Pending manual grading",
    };
  }

  const alternateRulings = matchingRulings.filter(
    (r) => r.type === "ACCEPT_ALTERNATE",
  );
  const alternateIds = new Set(
    alternateRulings.flatMap((r) => extractAcceptedAlternates(r.detail)),
  );
  const appliedRulingId =
    alternateRulings[alternateRulings.length - 1]?.id ?? null;

  const options = snapshot.optionsSnapshot ?? [];
  const correctIds = new Set(
    options
      .filter((opt) => opt.isCorrect || alternateIds.has(opt.id))
      .map((opt) => opt.id),
  );

  const validOptionIds = new Set(options.map((opt) => opt.id));
  const selected = Array.from(
    new Set(answer?.selectedOptionIds ?? []),
  ).filter((id) => validOptionIds.has(id));

  if (selected.length === 0) {
    return {
      score: 0,
      pending: false,
      rulingId: appliedRulingId,
      reason: "Unanswered",
    };
  }

  if (snapshot.typeSnapshot === "SINGLE") {
    const isCorrect = selected.length === 1 && correctIds.has(selected[0]);
    if (isCorrect) {
      return {
        score: snapshot.marksSnapshot,
        pending: false,
        rulingId: appliedRulingId,
        reason: appliedRulingId
          ? "Auto-graded with alternate ruling"
          : "Correct option",
      };
    }
    const penalty = negativeMarking > 0 ? -roundScore(negativeMarking) : 0;
    return {
      score: penalty,
      pending: false,
      rulingId: appliedRulingId,
      reason: penalty < 0 ? "Incorrect option (negative marking)" : "Incorrect option",
    };
  }

  // MULTI-select grading
  let correctSelected = 0;
  let wrongSelected = 0;
  for (const id of selected) {
    if (correctIds.has(id)) {
      correctSelected += 1;
    } else {
      wrongSelected += 1;
    }
  }

  if (snapshot.multiModeSnapshot === "ALL_OR_NOTHING") {
    const exactMatch =
      correctIds.size > 0 &&
      correctSelected === correctIds.size &&
      wrongSelected === 0;
    return {
      score: exactMatch ? snapshot.marksSnapshot : 0,
      pending: false,
      rulingId: appliedRulingId,
      reason: exactMatch ? "All correct options selected" : "Exact match required",
    };
  }

  // Default: PARTIAL_PENALTY -> max(0, (correctSelected - wrongSelected) / totalCorrect) * marks
  const totalCorrect = Math.max(1, correctIds.size);
  const ratio = Math.max(0, (correctSelected - wrongSelected) / totalCorrect);
  const score = roundScore(ratio * snapshot.marksSnapshot);

  return {
    score,
    pending: false,
    rulingId: appliedRulingId,
    reason: appliedRulingId
      ? "Auto-graded multi-select with ruling"
      : "Auto-graded multi-select",
  };
}

/**
 * Auto-grade objective questions inside an active transaction, writing
 * append-only Grade rows (gradedBy = null) and updating Attempt.totalScore.
 */
export async function autoGradeAttempt(
  tx: Prisma.TransactionClient,
  attemptId: string,
) {
  const attempt = await tx.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          rulings: { orderBy: { createdAt: "asc" } },
        },
      },
      questions: {
        orderBy: { position: "asc" },
        include: {
          answer: true,
          grades: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!attempt) return null;

  let totalScore = 0;
  let hasPendingWritten = false;
  const gradesToCreate: Array<{
    attemptQuestionId: string;
    score: number;
    gradedBy: null;
    rulingId: string | null;
    reason: string;
  }> = [];

  for (const aq of attempt.questions) {
    const existingLatestGrade = aq.grades[0];
    if (existingLatestGrade) {
      totalScore += existingLatestGrade.score;
      continue;
    }

    const result = gradeQuestion(
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
      attempt.exam.rulings,
      attempt.exam.negativeMarking,
    );

    if (result.pending || result.score === null) {
      hasPendingWritten = true;
      continue;
    }

    gradesToCreate.push({
      attemptQuestionId: aq.id,
      score: result.score,
      gradedBy: null,
      rulingId: result.rulingId,
      reason: result.reason,
    });
    totalScore += result.score;
  }

  if (gradesToCreate.length > 0) {
    await tx.grade.createMany({ data: gradesToCreate });
  }

  const roundedTotal = roundScore(totalScore);
  return tx.attempt.update({
    where: { id: attemptId },
    data: {
      totalScore: roundedTotal,
      ...(hasPendingWritten ? {} : { status: "GRADED" }),
    },
  });
}
