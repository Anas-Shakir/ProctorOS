import type { Difficulty, QuestionType } from "@prisma/client";
import { db } from "@/lib/db";
import { finalizeExpired } from "@/lib/attempts";
import {
  parseSelectedOptionIds,
  parseSnapshotOptions,
} from "@/lib/grading";
import { HttpError } from "@/lib/permissions";
import { realAttemptsWhere } from "@/lib/results";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeMedian(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return round2(sortedAsc[mid]);
  return round2((sortedAsc[mid - 1] + sortedAsc[mid]) / 2);
}

export interface HistogramBucket {
  range: string;
  count: number;
}

export interface QuestionAnalyticsRow {
  sourceQuestionId: string;
  order: number;
  topic: string;
  type: QuestionType;
  text: string;
  maxMarks: number;
  statedDifficulty: Difficulty;
  observedDifficulty: Difficulty;
  attemptsSeen: number;
  correctPercent: number;
  skipRate: number;
  topWrongDistractor: {
    optionId: string;
    text: string;
    count: number;
    percent: number;
  } | null;
  isSuspect: boolean;
  suspectReasons: string[];
}

export interface ExamAnalyticsPayload {
  exam: {
    id: string;
    title: string;
    totalMarks: number;
  };
  summary: {
    attemptCount: number;
    averageScore: number;
    medianScore: number;
    highestScore: number;
    lowestScore: number;
    passRate: number;
    averageTimeMinutes: number;
  };
  histogram: HistogramBucket[];
  questions: QuestionAnalyticsRow[];
}

export async function getExamAnalytics(
  examId: string,
): Promise<ExamAnalyticsPayload> {
  await finalizeExpired(examId);

  const [exam, attempts] = await Promise.all([
    db.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        title: true,
        totalMarks: true,
        examQuestions: {
          orderBy: { order: "asc" },
          include: {
            question: {
              select: {
                id: true,
                topic: true,
                difficulty: true,
                type: true,
                text: true,
                marks: true,
              },
            },
          },
        },
        rulings: {
          select: {
            sourceQuestionId: true,
            type: true,
            detail: true,
          },
        },
      },
    }),
    db.attempt.findMany({
      where: realAttemptsWhere({
        examId,
        status: { not: "IN_PROGRESS" },
      }),
      include: {
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
    }),
  ]);

  if (!exam) {
    throw new HttpError(404, "Exam not found");
  }

  const metaBySourceId = new Map(
    exam.examQuestions.map((eq) => [
      eq.questionId,
      {
        order: eq.order,
        topic: eq.question.topic,
        difficulty: eq.question.difficulty,
      },
    ]),
  );

  // Track accepted alternates per sourceQuestionId so analytics reflect active rulings too
  const alternateIdsBySource = new Map<string, Set<string>>();
  const voidedSources = new Set<string>();
  for (const r of exam.rulings) {
    if (r.type === "VOID_QUESTION") {
      voidedSources.add(r.sourceQuestionId);
    } else if (
      r.type === "ACCEPT_ALTERNATE" &&
      r.detail &&
      typeof r.detail === "object"
    ) {
      const ids = (r.detail as Record<string, unknown>).acceptedOptionIds;
      if (Array.isArray(ids)) {
        const set = alternateIdsBySource.get(r.sourceQuestionId) ?? new Set();
        for (const id of ids) {
          if (typeof id === "string") set.add(id);
        }
        alternateIdsBySource.set(r.sourceQuestionId, set);
      }
    }
  }

  const scores: number[] = [];
  const durationsMin: number[] = [];
  let passCount = 0;

  const histogram: HistogramBucket[] = [
    { range: "0–20%", count: 0 },
    { range: "20–40%", count: 0 },
    { range: "40–60%", count: 0 },
    { range: "60–80%", count: 0 },
    { range: "80–100%", count: 0 },
  ];

  interface QuestionAcc {
    sourceQuestionId: string;
    order: number;
    topic: string;
    type: QuestionType;
    text: string;
    maxMarks: number;
    statedDifficulty: Difficulty;
    attemptsSeen: number;
    fullMarksCount: number;
    skipCount: number;
    wrongOptionCounts: Map<string, { text: string; count: number }>;
  }

  const qAccMap = new Map<string, QuestionAcc>();

  for (const attempt of attempts) {
    let attemptTotal = 0;

    for (const aq of attempt.questions) {
      const latestGrade = aq.grades[0];
      if (latestGrade) {
        attemptTotal += latestGrade.score;
      }

      const meta = metaBySourceId.get(aq.sourceQuestionId);
      let acc = qAccMap.get(aq.sourceQuestionId);
      if (!acc) {
        acc = {
          sourceQuestionId: aq.sourceQuestionId,
          order: meta?.order ?? aq.position,
          topic: meta?.topic ?? "General",
          type: aq.typeSnapshot,
          text: aq.textSnapshot,
          maxMarks: aq.marksSnapshot,
          statedDifficulty: meta?.difficulty ?? "MEDIUM",
          attemptsSeen: 0,
          fullMarksCount: 0,
          skipCount: 0,
          wrongOptionCounts: new Map(),
        };
        qAccMap.set(aq.sourceQuestionId, acc);
      }

      acc.attemptsSeen += 1;

      const selectedIds = aq.answer
        ? parseSelectedOptionIds(aq.answer.selectedOptionIds)
        : [];
      const hasWritten = Boolean(
        aq.answer?.writtenText && aq.answer.writtenText.trim().length > 0,
      );
      const isSkipped =
        aq.typeSnapshot === "WRITTEN" ? !hasWritten : selectedIds.length === 0;

      if (isSkipped) {
        acc.skipCount += 1;
      }

      if (latestGrade && latestGrade.score >= aq.marksSnapshot - 0.001) {
        acc.fullMarksCount += 1;
      }

      if (aq.typeSnapshot !== "WRITTEN") {
        const options = parseSnapshotOptions(aq.optionsSnapshot);
        const optionById = new Map(options.map((o) => [o.id, o]));
        const altSet = alternateIdsBySource.get(aq.sourceQuestionId);
        const isVoided = voidedSources.has(aq.sourceQuestionId);

        for (const chosenId of selectedIds) {
          const opt = optionById.get(chosenId);
          if (!opt) continue;
          const countsAsCorrect =
            isVoided || opt.isCorrect || Boolean(altSet?.has(opt.id));
          if (!countsAsCorrect) {
            const prev = acc.wrongOptionCounts.get(opt.id);
            acc.wrongOptionCounts.set(opt.id, {
              text: opt.text,
              count: (prev?.count ?? 0) + 1,
            });
          }
        }
      }
    }

    const roundedTotal = round2(attemptTotal);
    scores.push(roundedTotal);

    const pct =
      exam.totalMarks > 0 ? (roundedTotal / exam.totalMarks) * 100 : 0;
    if (pct >= 50) {
      passCount += 1;
    }

    if (pct < 20) histogram[0].count += 1;
    else if (pct < 40) histogram[1].count += 1;
    else if (pct < 60) histogram[2].count += 1;
    else if (pct < 80) histogram[3].count += 1;
    else histogram[4].count += 1;

    if (attempt.submittedAt) {
      const diffMin = Math.max(
        0,
        (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 60_000,
      );
      durationsMin.push(diffMin);
    }
  }

  const attemptCount = scores.length;
  const sortedScores = [...scores].sort((a, b) => a - b);
  const averageScore =
    attemptCount > 0
      ? round2(scores.reduce((sum, s) => sum + s, 0) / attemptCount)
      : 0;
  const medianScore = computeMedian(sortedScores);
  const highestScore = attemptCount > 0 ? sortedScores[attemptCount - 1] : 0;
  const lowestScore = attemptCount > 0 ? sortedScores[0] : 0;
  const passRate =
    attemptCount > 0 ? round1((passCount / attemptCount) * 100) : 0;
  const averageTimeMinutes =
    durationsMin.length > 0
      ? round1(
          durationsMin.reduce((sum, m) => sum + m, 0) / durationsMin.length,
        )
      : 0;

  const questions: QuestionAnalyticsRow[] = Array.from(qAccMap.values())
    .sort((a, b) => a.order - b.order)
    .map((acc) => {
      const correctPercent =
        acc.attemptsSeen > 0
          ? round1((acc.fullMarksCount / acc.attemptsSeen) * 100)
          : 0;
      const skipRate =
        acc.attemptsSeen > 0
          ? round1((acc.skipCount / acc.attemptsSeen) * 100)
          : 0;

      let topWrongDistractor: QuestionAnalyticsRow["topWrongDistractor"] = null;
      for (const [optionId, info] of acc.wrongOptionCounts.entries()) {
        if (!topWrongDistractor || info.count > topWrongDistractor.count) {
          topWrongDistractor = {
            optionId,
            text: info.text,
            count: info.count,
            percent: round1((info.count / acc.attemptsSeen) * 100),
          };
        }
      }

      const observedDifficulty: Difficulty =
        correctPercent >= 70
          ? "EASY"
          : correctPercent >= 35
            ? "MEDIUM"
            : "HARD";

      const suspectReasons: string[] = [];
      if (acc.attemptsSeen > 0 && correctPercent < 15) {
        suspectReasons.push("Under 15% answered correctly");
      }
      if (
        acc.attemptsSeen > 0 &&
        topWrongDistractor &&
        topWrongDistractor.count > acc.fullMarksCount
      ) {
        suspectReasons.push(
          `Distractor "${topWrongDistractor.text}" chosen ${topWrongDistractor.count}× vs ${acc.fullMarksCount}× correct`,
        );
      }

      return {
        sourceQuestionId: acc.sourceQuestionId,
        order: acc.order,
        topic: acc.topic,
        type: acc.type,
        text: acc.text,
        maxMarks: acc.maxMarks,
        statedDifficulty: acc.statedDifficulty,
        observedDifficulty,
        attemptsSeen: acc.attemptsSeen,
        correctPercent,
        skipRate,
        topWrongDistractor,
        isSuspect: suspectReasons.length > 0,
        suspectReasons,
      };
    });

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      totalMarks: exam.totalMarks,
    },
    summary: {
      attemptCount,
      averageScore,
      medianScore,
      highestScore,
      lowestScore,
      passRate,
      averageTimeMinutes,
    },
    histogram,
    questions,
  };
}
