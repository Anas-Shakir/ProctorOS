import Papa from "papaparse";
import {
  questionInputSchema,
  type QuestionInput,
} from "@/lib/validators/question";

export interface ImportFailure {
  row: number;
  field: string;
  message: string;
}

export interface ParsedImportBatch<T> {
  validRows: T[];
  failed: ImportFailure[];
}

export interface ImportReport {
  imported: number;
  failed: ImportFailure[];
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function parseCsvOptions(raw: Record<string, unknown>): {
  options: Array<{ text: string; isCorrect: boolean }>;
  error?: { field: string; message: string };
} {
  const type = String(raw.type ?? "").trim().toUpperCase();
  if (type === "WRITTEN") {
    return { options: [] };
  }

  let optionTexts: string[] = [];
  const pipeOptions = String(raw.options ?? "").trim();
  if (pipeOptions) {
    optionTexts = pipeOptions
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    optionTexts = [
      raw.option1 ?? raw.a,
      raw.option2 ?? raw.b,
      raw.option3 ?? raw.c,
      raw.option4 ?? raw.d,
      raw.option5 ?? raw.e,
    ]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
  }

  const correctRaw = String(raw.correct ?? raw.correctoptions ?? "").trim();
  if (!correctRaw && optionTexts.length >= 2) {
    return {
      options: [],
      error: {
        field: "correct",
        message: "Specify correct option index (e.g. 1 or 1,3) or text",
      },
    };
  }

  const tokens = correctRaw
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const correctIndexes = new Set<number>();
  const correctLabels = new Set<string>();

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      const idx = Number.parseInt(token, 10) - 1;
      if (idx < 0 || idx >= optionTexts.length) {
        return {
          options: [],
          error: {
            field: "correct",
            message: `Correct index "${token}" is out of range (1..${optionTexts.length})`,
          },
        };
      }
      correctIndexes.add(idx);
    } else {
      correctLabels.add(token.toLowerCase());
    }
  }

  const options = optionTexts.map((text, idx) => ({
    text,
    isCorrect:
      correctIndexes.has(idx) || correctLabels.has(text.toLowerCase()),
  }));

  return { options };
}

function normalizeRawQuestion(
  raw: Record<string, unknown>,
  fromCsv: boolean,
): { payload?: unknown; preError?: { field: string; message: string } } {
  const topic = String(raw.topic ?? "").trim();
  const difficulty = String(raw.difficulty ?? "").trim().toUpperCase();
  const type = String(raw.type ?? "").trim().toUpperCase();
  const text = String(raw.text ?? "").trim();
  const marks = raw.marks;
  const multiModeRaw = String(raw.multimode ?? raw.multiMode ?? "")
    .trim()
    .toUpperCase();
  const multiMode = multiModeRaw || "PARTIAL_PENALTY";

  if (fromCsv) {
    const parsedOpts = parseCsvOptions(raw);
    if (parsedOpts.error) {
      return { preError: parsedOpts.error };
    }
    return {
      payload: {
        topic,
        difficulty,
        type,
        text,
        marks,
        multiMode,
        options: parsedOpts.options,
      },
    };
  }

  return {
    payload: {
      topic,
      difficulty,
      type,
      text,
      marks,
      multiMode,
      options: Array.isArray(raw.options) ? raw.options : [],
    },
  };
}

/**
 * Parse and row-validate a CSV or JSON question upload.
 * Valid rows are returned separately from rejected rows so valid rows still import.
 */
export function parseQuestionImportFile(
  fileName: string,
  content: string,
): ParsedImportBatch<QuestionInput> {
  const validRows: QuestionInput[] = [];
  const failed: ImportFailure[] = [];

  const trimmed = content.trim();
  if (!trimmed) {
    return {
      validRows,
      failed: [{ row: 0, field: "file", message: "Uploaded file is empty" }],
    };
  }

  const isJson =
    fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("[");

  let rawEntries: Array<{ row: number; data: Record<string, unknown> }> = [];

  if (isJson) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        return {
          validRows,
          failed: [
            {
              row: 0,
              field: "file",
              message: "JSON upload must be an array of question objects",
            },
          ],
        };
      }
      rawEntries = parsed.map((item, idx) => ({
        row: idx + 1,
        data:
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : {},
      }));
    } catch {
      return {
        validRows,
        failed: [{ row: 0, field: "file", message: "Invalid JSON syntax" }],
      };
    }
  } else {
    const csv = Papa.parse<Record<string, unknown>>(trimmed, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
    });

    if (csv.errors.length > 0 && csv.data.length === 0) {
      return {
        validRows,
        failed: csv.errors.map((err) => ({
          row: (err.row ?? 0) + 2,
          field: "csv",
          message: err.message,
        })),
      };
    }

    rawEntries = csv.data.map((item, idx) => ({
      row: idx + 2, // Header is row 1
      data: item,
    }));
  }

  for (const entry of rawEntries) {
    const normalized = normalizeRawQuestion(entry.data, !isJson);
    if (normalized.preError) {
      failed.push({
        row: entry.row,
        field: normalized.preError.field,
        message: normalized.preError.message,
      });
      continue;
    }

    const result = questionInputSchema.safeParse(normalized.payload);
    if (!result.success) {
      const issue = result.error.issues[0];
      failed.push({
        row: entry.row,
        field: String(issue?.path[0] ?? "row"),
        message: issue?.message ?? "Invalid question row",
      });
      continue;
    }

    validRows.push(result.data);
  }

  return { validRows, failed };
}

export const SAMPLE_QUESTIONS_CSV = `topic,difficulty,type,text,marks,multiMode,options,correct
Transactions,MEDIUM,SINGLE,"Which SQL isolation level prevents phantom reads?",2,PARTIAL_PENALTY,"Read Uncommitted|Read Committed|Repeatable Read|Serializable",4
Indexing,EASY,MULTI,"Select all true statements about B-Tree indexes.",3,PARTIAL_PENALTY,"Supports range queries|Always hashes keys|Maintains sorted order|Cannot index strings","1,3"
Concurrency,HARD,WRITTEN,"Explain the difference between optimistic and pessimistic concurrency control.",5,PARTIAL_PENALTY,,
`;

export const SAMPLE_QUESTIONS_JSON = JSON.stringify(
  [
    {
      topic: "Transactions",
      difficulty: "MEDIUM",
      type: "SINGLE",
      text: "Which SQL isolation level prevents phantom reads?",
      marks: 2,
      options: [
        { text: "Read Uncommitted", isCorrect: false },
        { text: "Read Committed", isCorrect: false },
        { text: "Repeatable Read", isCorrect: false },
        { text: "Serializable", isCorrect: true },
      ],
    },
    {
      topic: "Indexing",
      difficulty: "EASY",
      type: "MULTI",
      text: "Select all true statements about B-Tree indexes.",
      marks: 3,
      multiMode: "PARTIAL_PENALTY",
      options: [
        { text: "Supports range queries", isCorrect: true },
        { text: "Always hashes keys", isCorrect: false },
        { text: "Maintains sorted order", isCorrect: true },
        { text: "Cannot index strings", isCorrect: false },
      ],
    },
    {
      topic: "Concurrency",
      difficulty: "HARD",
      type: "WRITTEN",
      text: "Explain the difference between optimistic and pessimistic concurrency control.",
      marks: 5,
      options: [],
    },
  ],
  null,
  2,
);
